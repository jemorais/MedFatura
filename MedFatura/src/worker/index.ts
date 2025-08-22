import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { getCookie, setCookie, deleteCookie } from 'hono/cookie';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Buffer } from 'node:buffer';
import sgMail from '@sendgrid/mail';

// Environment definition
interface Env {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  SESSION_SECRET: string; // Kept for potential future use, but not for Supabase JWT
  SENDGRID_API_KEY: string;
  R2_BUCKET_NAME: string;
}

type AppContext = {
  Bindings: Env;
  Variables: {
    supabase: SupabaseClient;
    user: any; // Supabase user object
  };
};

const app = new Hono<AppContext>();

// Middleware to initialize Supabase client
app.use('*', async (c, next) => {
  const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_ROLE_KEY);
  c.set('supabase', supabase);
  await next();
});

// CORS configuration
app.use('/api/*', cors({
  origin: (origin) => {
    const allowedOrigins = [
      'http://localhost:5173',
      'http://127.0.0.1:5173',
      'https://medfatura.com.br',
      'https://www.medfatura.com.br'
    ];
    if (allowedOrigins.includes(origin)) {
      return origin;
    }
    return null;
  },
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}));

// Auth middleware
const authMiddleware = async (c: any, next: any) => {
  const supabase = c.get('supabase');
  const token = c.req.header('Authorization')?.replace('Bearer ', '');
  const sessionCookie = getCookie(c, 'session_id');

  let user = null;
  let sessionToken = token || sessionCookie;

  if (sessionToken) {
    const { data, error } = await supabase.auth.getUser(sessionToken);
    if (!error) {
      user = data.user;
    }
  }

  if (!user) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  // Attach user profile to the user object for easier access
  const { data: profile } = await supabase
    .from('profiles')
    .select('*, user_type:user_types(name)')
    .eq('id', user.id)
    .single();

  user.profile = profile;
  c.set('user', user);
  await next();
};

// Admin middleware
const adminMiddleware = async (c: any, next: any) => {
    const user = c.get('user');
    if (!user || user.profile?.user_type?.name !== 'admin') {
        return c.json({ error: 'Forbidden' }, 403);
    }
    await next();
};


// --- AUTH ROUTES ---

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

app.post('/api/auth/login', zValidator('json', LoginSchema), async (c) => {
  const { email, password } = c.req.valid('json');
  const supabase = c.get('supabase');

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return c.json({ error: 'Invalid credentials' }, 401);
  }

  if (data.session) {
    setCookie(c, 'session_id', data.session.access_token, {
      httpOnly: true,
      secure: true,
      sameSite: 'Strict',
      path: '/',
      maxAge: data.session.expires_in,
    });
  }

  return c.json({ user: data.user, session: data.session });
});

app.post('/api/auth/logout', async (c) => {
  deleteCookie(c, 'session_id', { path: '/' });
  return c.json({ message: 'Logged out successfully' });
});

app.get('/api/auth/me', authMiddleware, (c) => {
  const user = c.get('user');
  return c.json(user);
});


// --- INVOICE ROUTES ---

app.get('/api/invoices', authMiddleware, async (c) => {
    const user = c.get('user');
    const supabase = c.get('supabase');
    const isAdmin = user.profile.user_type.name === 'admin';

    let query = supabase.from('invoices').select('*');

    if (!isAdmin) {
        query = query.eq('user_id', user.id);
    }

    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) {
        console.error('Error fetching invoices:', error);
        return c.json({ error: 'Failed to fetch invoices' }, 500);
    }
    return c.json(data);
});

app.post('/api/invoices/upload', authMiddleware, async (c) => {
    const user = c.get('user');
    const supabase = c.get('supabase');
    const formData = await c.req.formData();
    const file = formData.get('file') as File;
    const month = formData.get('month');
    const year = formData.get('year');

    if (!file || !month || !year) {
        return c.json({ error: 'Missing required fields' }, 400);
    }

    const fileName = `${user.id}/${year}-${month}-${file.name}`;
    const { error: uploadError } = await supabase.storage
        .from(c.env.R2_BUCKET_NAME)
        .upload(fileName, file);

    if (uploadError) {
        console.error('Error uploading invoice to R2:', uploadError);
        return c.json({ error: 'Failed to upload file' }, 500);
    }

    const { data, error: dbError } = await supabase
        .from('invoices')
        .insert({
            user_id: user.id,
            month: parseInt(month as string),
            year: parseInt(year as string),
            original_filename: file.name,
            stored_filename: fileName,
            file_size: file.size,
            status: 'recebido',
        })
        .select()
        .single();

    if (dbError) {
        console.error('Error saving invoice metadata:', dbError);
        // Attempt to delete the uploaded file to avoid orphans
        await supabase.storage.from(c.env.R2_BUCKET_NAME).remove([fileName]);
        return c.json({ error: 'Failed to save invoice metadata' }, 500);
    }

    return c.json(data, 201);
});

app.get('/api/invoices/:id/download', authMiddleware, async (c) => {
    const user = c.get('user');
    const supabase = c.get('supabase');
    const invoiceId = c.req.param('id');
    const isAdmin = user.profile.user_type.name === 'admin';

    const { data: invoice, error } = await supabase
        .from('invoices')
        .select('user_id, stored_filename')
        .eq('id', invoiceId)
        .single();

    if (error || !invoice) {
        return c.json({ error: 'Invoice not found' }, 404);
    }

    if (!isAdmin && invoice.user_id !== user.id) {
        return c.json({ error: 'Forbidden' }, 403);
    }

    const { data: fileData, error: downloadError } = await supabase.storage
        .from(c.env.R2_BUCKET_NAME)
        .download(invoice.stored_filename);

    if (downloadError) {
        console.error('Error downloading file from R2:', downloadError);
        return c.json({ error: 'File not available' }, 404);
    }

    return new Response(fileData.stream(), {
        headers: {
            'Content-Type': 'application/pdf',
            'Content-Disposition': `attachment; filename="${invoice.stored_filename.split('/').pop()}"`,
        },
    });
});

app.delete('/api/invoices/:id', authMiddleware, async (c) => {
    const user = c.get('user');
    const supabase = c.get('supabase');
    const invoiceId = c.req.param('id');
    const isAdmin = user.profile.user_type.name === 'admin';

    const { data: invoice, error } = await supabase
        .from('invoices')
        .select('user_id, stored_filename')
        .eq('id', invoiceId)
        .single();

    if (error || !invoice) {
        return c.json({ error: 'Invoice not found' }, 404);
    }

    if (!isAdmin && invoice.user_id !== user.id) {
        return c.json({ error: 'Forbidden' }, 403);
    }

    // Delete from R2 first
    const { error: storageError } = await supabase.storage
        .from(c.env.R2_BUCKET_NAME)
        .remove([invoice.stored_filename]);

    if (storageError) {
        console.error("Failed to delete from R2, but proceeding to delete DB record:", storageError);
    }

    // Delete from database
    const { error: dbError } = await supabase
        .from('invoices')
        .delete()
        .eq('id', invoiceId);

    if (dbError) {
        console.error('Error deleting invoice from DB:', dbError);
        return c.json({ error: 'Failed to delete invoice' }, 500);
    }

    return c.json({ success: true });
});


// --- NOTIFICATION ROUTES ---

app.get('/api/notifications', authMiddleware, async (c) => {
    const user = c.get('user');
    const supabase = c.get('supabase');

    const { data, error } = await supabase
        .from('notifications')
        .select('*, from_user:profiles!from_user_id(name)')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50);

    if (error) {
        console.error('Error fetching notifications:', error);
        return c.json({ error: 'Failed to fetch notifications' }, 500);
    }
    return c.json({ notifications: data });
});

app.put('/api/notifications/:id/read', authMiddleware, async (c) => {
    const user = c.get('user');
    const supabase = c.get('supabase');
    const notificationId = c.req.param('id');

    const { error } = await supabase
        .from('notifications')
        .update({ is_read: true, read_at: new Date().toISOString() })
        .eq('id', notificationId)
        .eq('user_id', user.id);

    if (error) {
        console.error('Error marking notification as read:', error);
        return c.json({ error: 'Failed to update notification' }, 500);
    }
    return c.json({ success: true });
});

app.get('/api/notifications/unread-count', authMiddleware, async (c) => {
    const user = c.get('user');
    const supabase = c.get('supabase');

    const { count, error } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('is_read', false);

    if (error) {
        console.error('Error counting unread notifications:', error);
        return c.json({ error: 'Failed to count notifications' }, 500);
    }
    return c.json({ unread_count: count });
});


// --- STATS ROUTES ---

app.get('/api/stats', authMiddleware, async (c) => {
    const user = c.get('user');
    const supabase = c.get('supabase');
    const isAdmin = user.profile.user_type.name === 'admin';

    // Total Invoices
    let invoicesQuery = supabase.from('invoices').select('*', { count: 'exact', head: true });
    if (!isAdmin) {
        invoicesQuery = invoicesQuery.eq('user_id', user.id);
    }
    const { count: totalInvoices, error: invoicesError } = await invoicesQuery;

    // Active Users (Admin only)
    let activeUsers = 1;
    if (isAdmin) {
        const { count, error } = await supabase
            .from('profiles')
            .select('*', { count: 'exact', head: true })
            .eq('is_active', true);
        if (!error) activeUsers = count;
    }

    // Pending Payments
    let pendingQuery = supabase.from('pending_payments').select('*', { count: 'exact', head: true }).eq('status', 'pending');
    if (!isAdmin) {
        pendingQuery = pendingQuery.eq('user_id', user.id);
    }
    const { count: pendingInvoices, error: pendingError } = await pendingQuery;

    if (invoicesError || pendingError) {
        console.error({ invoicesError, pendingError });
        return c.json({ error: 'Failed to fetch stats' }, 500);
    }

    return c.json({
        totalInvoices: totalInvoices ?? 0,
        pendingInvoices: pendingInvoices ?? 0,
        activeUsers,
    });
});

// --- PENDING PAYMENTS ROUTES (ADMIN) ---

const PendingPaymentSchema = z.object({
  user_id: z.string().uuid(),
  amount: z.number().positive(),
  description: z.string().min(1),
  month: z.number().min(1).max(12),
  year: z.number().min(2020),
  notes: z.string().optional(),
});

app.post('/api/pending-payments', authMiddleware, adminMiddleware, zValidator('json', PendingPaymentSchema), async (c) => {
    const admin = c.get('user');
    const supabase = c.get('supabase');
    const { user_id, amount, description, month, year, notes } = c.req.valid('json');

    const { data: payment, error } = await supabase
        .from('pending_payments')
        .insert({
            user_id,
            admin_id: admin.id,
            amount,
            description,
            month,
            year,
            notes,
            status: 'pending',
        })
        .select()
        .single();

    if (error) {
        console.error('Error creating pending payment:', error);
        return c.json({ error: 'Failed to create pending payment' }, 500);
    }

    // Create notification
    await supabase.from('notifications').insert({
        user_id,
        from_user_id: admin.id,
        type: 'pending_payment',
        title: 'Nova Cobrança Pendente',
        message: `Você tem uma nova cobrança de R$ ${amount.toFixed(2)} para ${description}`,
        related_id: payment.id,
    });

    return c.json(payment, 201);
});

app.get('/api/pending-payments', authMiddleware, adminMiddleware, async (c) => {
    const supabase = c.get('supabase');
    const { data, error } = await supabase
        .from('pending_payments')
        .select('*, user:profiles!user_id(name, email), admin:profiles!admin_id(name)')
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Error fetching pending payments:', error);
        return c.json({ error: 'Failed to fetch data' }, 500);
    }
    return c.json({ pending_payments: data });
});


export default app;
