# 🚀 Metrifique-se CRM & Whitelabel Multi-Tenant SaaS

Plataforma de **CRM Whitelabel e Gestão Comercial Multi-Tenant SaaS** construída com HTML5, CSS3, JavaScript (ES6+), Vite, Bootstrap 5 e Supabase.

![Metrifique-se CRM](src/assets/images/logos/metrifiquese.svg)

---

## 🌟 Principais Recursos

- **🏢 Multi-Tenant Data Isolation (100% de Isolamento por Empresa)**:
  - Cada empresa cliente possui sua própria base de contatos, funis (Kanban), métricas e automações isoladas via `tenant_id`.
  - Nenhuma empresa cliente enxerga dados de outros clientes ou do Super Admin.

- **👑 Painel Super Admin (Gestão de Empresas & MRR)**:
  - Painel exclusivo (`/admin-tenants.html`) para gerenciamento dos clientes do SaaS.
  - Métricas em tempo real: **Total de Empresas**, **Receita Recorrente Mensal (MRR R$)** e **Total de Leads**.
  - **Modo de Inspeção**: Permite ao Super Admin inspecionar a conta de qualquer cliente em 1 clique com banner visual e botão para retornar ao Master.

- **👥 Gestão de Equipes & Credenciais**:
  - Cadastro de membros de equipe para cada empresa cliente com **Login (E-mail)** e **Senha de Acesso**.

- **🎨 Dynamic Whitelabel Engine**:
  - Troca dinâmica de cor primária, logotipo, favicon e título do documento por empresa cliente.

- **🔐 Supabase Auth & Local Store Fallback**:
  - Integração nativa com `@supabase/supabase-js` v2.
  - Fallback local de persistência para demonstrações e testes offline.

- **📊 Gestão Comercial Completa**:
  - **Base de Leads**: Visualização em 3 colunas com timeline de atividades, Lead Scoring e filtros.
  - **Funil de Vendas (Kanban)**: Drag and drop interativo de oportunidades por etapa.
  - **Automações & Webhooks**: Regras por Lead Score e captura via Webhooks.
  - **Relatórios**: Taxa de conversão e gráficos comerciais ApexCharts.

---

## 🔑 Acesso Padrão Super Admin (Master)

| Parâmetro | Valor |
| :--- | :--- |
| **Nome** | Paulo Garcia |
| **E-mail (Login)** | `paulo@southsea.com.br` |
| **Senha Padrão** | `12345678` *(Editável na tela de Perfil)* |
| **Painel Master** | `/src/html/admin-tenants.html` |

> 💡 **Nota de Segurança**: Você pode alterar sua senha de acesso a qualquer momento navegando até **Perfil de Usuário** (`/src/html/perfil.html`) e salvando sua nova senha no formulário.

---

## ⚙️ Variáveis de Ambiente (`.env`)

Para proteger suas credenciais do Supabase no GitHub, utilize variáveis de ambiente.

1. Duplique o arquivo `.env.example`:
   ```bash
   cp .env.example .env
   ```

2. Preencha suas chaves do Supabase Cloud no `.env`:
   ```env
   VITE_SUPABASE_URL=https://seu-projeto.supabase.co
   VITE_SUPABASE_ANON_KEY=sua-anon-key-aqui
   ```

*(O arquivo `.env` está incluído no `.gitignore` para nunca ser exposto no repositório)*.

---

## 🚀 Como Rodar o Projeto Localmente

```bash
# 1. Clonar o repositório
git clone https://github.com/garciagoedert/metrifiquese.git

# 2. Entrar na pasta do projeto
cd metrifiquese

# 3. Instalar dependências
npm install

# 4. Iniciar servidor de desenvolvimento local (Vite)
npm run dev
```

Acesse no navegador: `http://localhost:7000/` ou `http://localhost:7000/src/html/login.html`.

---

## 🌐 Deploy Online na Vercel

1. Importe este repositório na [Vercel](https://vercel.com/new).
2. O comando de build será identificado automaticamente como `npm run build`.
3. Adicione as variáveis de ambiente `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` nas configurações da Vercel (**Settings -> Environment Variables**).
4. Clique em **Deploy**.

---

## 🗄️ Banco de Dados PostgreSQL (Supabase SQL Schema)

O script SQL de criação das tabelas com Row Level Security (RLS) está disponível em:
[`/supabase/schema.sql`](./supabase/schema.sql)

---

## 📄 Licença

Desenvolvido para **Metrifique-se CRM Whitelabel**. Todos os direitos reservados.