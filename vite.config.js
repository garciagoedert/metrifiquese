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
    build: {
      outDir: 'dist',
      rollupOptions: {
        input: {
          main: resolve(__dirname, 'index.html'),
          login: resolve(__dirname, 'src/html/login.html'),
          authLogin: resolve(__dirname, 'src/html/authentication-login.html'),
          crmDashboard: resolve(__dirname, 'src/html/index.html'),
          leads: resolve(__dirname, 'src/html/leads.html'),
          kanban: resolve(__dirname, 'src/html/kanban.html'),
          adminTenants: resolve(__dirname, 'src/html/admin-tenants.html'),
          automacoes: resolve(__dirname, 'src/html/automacoes.html'),
          capturas: resolve(__dirname, 'src/html/capturas.html'),
          relatorios: resolve(__dirname, 'src/html/relatorios.html'),
          configuracoesWhitelabel: resolve(__dirname, 'src/html/configuracoes-whitelabel.html'),
          perfil: resolve(__dirname, 'src/html/perfil.html')
        }
      }
    }
  };
});
