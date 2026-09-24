import { defineConfig, loadEnv } from 'vite';
import { resolve } from 'path';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const sbUrl = env.VITE_SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'https://syvqisjpulryjlgksjrk.supabase.co';
  const sbAnonKey = env.VITE_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

  return {
    define: {
      '__SUPABASE_URL__': JSON.stringify(sbUrl),
      '__SUPABASE_ANON_KEY__': JSON.stringify(sbAnonKey)
    },
    plugins: [
      {
        name: 'api-server-middleware',
        configureServer(server) {
          server.middlewares.use(async (req, res, next) => {
            const rawUrl = req.url || '';
            const urlPath = rawUrl.split('?')[0];
            if (urlPath === '/api/leads' || urlPath === '/api/webhook' || urlPath === '/api/v1/leads/webhook') {
              try {
                // Parse query parameters
                const queryStr = rawUrl.includes('?') ? rawUrl.split('?')[1] : '';
                const searchParams = new URLSearchParams(queryStr);
                const query = {};
                for (const [k, v] of searchParams.entries()) {
                  query[k] = v;
                }
                req.query = query;

                const { createRequire } = await import('module');
                const reqRequire = createRequire(import.meta.url);
                const handler = reqRequire('./api/_handler.js');
                return handler(req, res);
              } catch (e) {
                console.error('[Vite API Dev Middleware Error]', e);
                res.statusCode = 500;
                res.setHeader('Content-Type', 'application/json');
                return res.end(JSON.stringify({ success: false, error: e.message }));
              }
            }
            next();
          });
        }
      }
    ],
    build: {
      outDir: 'dist',
      rollupOptions: {
        input: {
          main: resolve(__dirname, 'index.html'),
          login: resolve(__dirname, 'src/html/login.html'),
          authLogin: resolve(__dirname, 'src/html/authentication-login.html'),
          crmDashboard: resolve(__dirname, 'src/html/dashboard.html'),
          leads: resolve(__dirname, 'src/html/leads.html'),
          kanban: resolve(__dirname, 'src/html/kanban.html'),
          adminTenants: resolve(__dirname, 'src/html/admin-tenants.html'),
          automacoes: resolve(__dirname, 'src/html/automacoes.html'),
          capturas: resolve(__dirname, 'src/html/capturas.html'),
          relatorios: resolve(__dirname, 'src/html/relatorios.html'),
          configuracoesWhitelabel: resolve(__dirname, 'src/html/configuracoes-whitelabel.html'),
          perfil: resolve(__dirname, 'src/html/perfil.html'),
          form: resolve(__dirname, 'src/html/form.html')
        }
      }
    }
  };
});
