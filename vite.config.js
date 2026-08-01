import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
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
});
