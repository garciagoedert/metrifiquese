/**
 * Metrifique-se CRM - Analytics & Dashboard Charts (ApexCharts)
 * All charts use REAL data from crmStore (deals + leads).
 */

class AnalyticsManager {
  constructor() {
    this.charts = {};
    this.init();
  }

  init() {
    document.addEventListener('DOMContentLoaded', () => {
      setTimeout(() => this.renderAll(), 300);
    });
    window.addEventListener('deals-synced', () => this.renderAll());
    window.addEventListener('leads-synced', () => this.renderAll());
  }

  renderAll() {
    this.renderMetricsCards();
    this.renderFunnelChart();
    this.renderSourcesChart();
    this.renderRevenueChart();
    this.renderInsightsSection();
  }

  generateBusinessInsights() {
    const stats = this.getCRMStats();
    const leads = window.crmStore ? window.crmStore.getLeads() : [];
    const deals = window.crmStore ? window.crmStore.getDeals() : [];
    const stages = window.crmStore ? window.crmStore.getStages() : [];

    const insights = [];

    // 1. Bottleneck check
    const stageValues = {};
    deals.forEach(d => {
      stageValues[d.stage_id] = (stageValues[d.stage_id] || 0) + (parseFloat(d.value) || 0);
    });

    let bottleneckStage = null;
    let maxStageValue = 0;
    Object.keys(stageValues).forEach(stId => {
      if (stageValues[stId] > maxStageValue) {
        maxStageValue = stageValues[stId];
        bottleneckStage = stages.find(s => s.id === stId);
      }
    });

    if (bottleneckStage && maxStageValue > 0) {
      insights.push({
        type: 'warning',
        icon: 'ti-alert-triangle',
        title: 'Alerta de Gargalo no Funil',
        description: `A etapa <strong>"${bottleneckStage.name}"</strong> acumula R$ ${maxStageValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} em oportunidades paradas. Dispare um follow-up rápido via WhatsApp para acelerar os fechamentos.`
      });
    }

    // 2. Conversion trend check
    const conversionPct = parseFloat(stats.conversionRate);
    if (conversionPct >= 20) {
      insights.push({
        type: 'success',
        icon: 'ti-trending-up',
        title: 'Excelente Desempenho Comercial',
        description: `Sua taxa de conversão em vendas está em <strong>${conversionPct}%</strong>, superando a média do mercado (15%). Mantenha o ritmo de atendimento!`
      });
    } else if (stats.totalLeads > 5 && conversionPct < 10) {
      insights.push({
        type: 'warning',
        icon: 'ti-activity',
        title: 'Oportunidade de Ajuste em Qualificação',
        description: `Sua taxa de conversão atual é de <strong>${conversionPct}%</strong>. Recomendamos ativar regras de Lead Scoring para focar seus vendedores nos contatos mais quentes.`
      });
    }

    // 3. Best Lead Source
    const sourceValues = {};
    deals.forEach(d => {
      const lead = leads.find(l => l.id === d.lead_id);
      const src = (lead && lead.source) ? lead.source : 'Outros';
      sourceValues[src] = (sourceValues[src] || 0) + (parseFloat(d.value) || 0);
    });

    let topSource = null;
    let topSourceVal = 0;
    Object.keys(sourceValues).forEach(src => {
      if (sourceValues[src] > topSourceVal) {
        topSourceVal = sourceValues[src];
        topSource = src;
      }
    });

    if (topSource && topSourceVal > 0) {
      insights.push({
        type: 'info',
        icon: 'ti-target-arrow',
        title: 'Canal de Maior Retorno (ROI)',
        description: `A origem <strong>"${topSource}"</strong> gerou R$ ${topSourceVal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} em volume comercial. Reforce os investimentos de tráfego neste canal.`
      });
    }

    // Default welcome insight
    if (insights.length === 0) {
      insights.push({
        type: 'info',
        icon: 'ti-sparkles',
        title: 'Diagnóstico Inteligente Metrifiquese',
        description: 'Cadastre suas primeiras oportunidades no Kanban para que o motor de inteligência calcule automaticamente gargalos, taxas de conversão e estratégias de aceleração comercial.'
      });
    }

    return insights;
  }

  renderInsightsSection() {
    const container = document.getElementById('business-insights-container');
    if (!container) return;

    const insights = this.generateBusinessInsights();
    
    container.innerHTML = insights.map(i => {
      const bgMap = {
        warning: 'bg-light-warning border-warning text-warning-emphasis',
        success: 'bg-light-success border-success text-success-emphasis',
        info: 'bg-light-primary border-primary text-primary-emphasis'
      };
      const iconMap = {
        warning: 'text-warning bg-warning bg-opacity-10',
        success: 'text-success bg-success bg-opacity-10',
        info: 'text-primary bg-primary bg-opacity-10'
      };

      return `
        <div class="col-md-6 col-lg-4 mb-3">
          <div class="card border shadow-sm h-100 p-3 ${bgMap[i.type] || ''}">
            <div class="d-flex align-items-start gap-3">
              <div class="p-2 rounded-circle ${iconMap[i.type] || ''}">
                <i class="ti ${i.icon} fs-6"></i>
              </div>
              <div>
                <h6 class="fw-bold mb-1 text-dark">${i.title}</h6>
                <p class="fs-2 mb-0 text-muted" style="line-height: 1.5;">${i.description}</p>
              </div>
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  getCRMStats() {
    const leads = window.crmStore ? window.crmStore.getLeads() : [];
    const deals = window.crmStore ? window.crmStore.getDeals() : [];

    const totalLeads = leads.length;
    const mqlCount  = leads.filter(l => l.lifecycle_stage === 'mql').length;
    const oppCount  = leads.filter(l => l.lifecycle_stage === 'opportunity').length;
    const customerCount = leads.filter(l => l.lifecycle_stage === 'customer').length;

    const totalPipelineValue = deals.reduce((s, d) => s + (parseFloat(d.value) || 0), 0);
    const wonDeals  = deals.filter(d => d.status === 'won' || d.stage_id === 'stage-5');
    const wonValue  = wonDeals.reduce((s, d) => s + (parseFloat(d.value) || 0), 0);
    const lostDeals = deals.filter(d => d.status === 'lost' || d.stage_id === 'stage-lost');
    const lostValue = lostDeals.reduce((s, d) => s + (parseFloat(d.value) || 0), 0);

    const conversionRate = totalLeads > 0
      ? ((customerCount / totalLeads) * 100).toFixed(1)
      : '0.0';

    return { totalLeads, mqlCount, oppCount, customerCount, totalPipelineValue, wonValue, lostValue, wonDeals: wonDeals.length, lostDeals: lostDeals.length, conversionRate, deals };
  }

  renderMetricsCards() {
    const stats = this.getCRMStats();
    const set = (id, val) => { const el = document.getElementById(id); if (el) el.innerText = val; };

    set('stat-total-leads',     stats.totalLeads);
    set('stat-conversion-rate', stats.conversionRate + '%');
    set('stat-pipeline-value',  'R$ ' + stats.totalPipelineValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 }));
    set('stat-won-value',       'R$ ' + stats.wonValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 }));
  }

  // ── FUNIL DE CONVERSÃO (dados reais) ──────────────────────────────────
  renderFunnelChart() {
    const chartEl = document.getElementById('funnel-chart');
    if (!chartEl || !window.ApexCharts) return;

    const stats = this.getCRMStats();

    if (this.charts.funnel) { try { this.charts.funnel.destroy(); } catch(e){} }

    this.charts.funnel = new ApexCharts(chartEl, {
      series: [{ name: 'Contatos', data: [stats.totalLeads, stats.mqlCount, stats.oppCount, stats.customerCount] }],
      chart: { type: 'bar', height: 320, fontFamily: "'Plus Jakarta Sans', sans-serif", toolbar: { show: false } },
      plotOptions: { bar: { borderRadius: 8, horizontal: true, distributed: true, barHeight: '55%' } },
      colors: ['#FF7A59', '#00A4BD', '#F59E0B', '#10B981'],
      dataLabels: {
        enabled: true,
        style: { fontSize: '13px', fontWeight: 700, colors: ['#FFF'] },
        formatter: (val, opt) => opt.w.globals.labels[opt.dataPointIndex] + ': ' + val
      },
      xaxis: {
        categories: ['Leads Capturados', 'MQL (Qualificados)', 'Oportunidades', 'Clientes Fechados'],
        labels: { style: { colors: '#475569', fontSize: '12px', fontWeight: 600 } }
      },
      yaxis: { labels: { style: { colors: '#0F172A', fontSize: '13px', fontWeight: 700 } } },
      legend: { show: false }
    });
    this.charts.funnel.render();
  }

  // ── ORIGEM DOS CONTATOS (dados reais) ─────────────────────────────────
  renderSourcesChart() {
    const chartEl = document.getElementById('sources-chart');
    if (!chartEl || !window.ApexCharts) return;

    const leads = window.crmStore ? window.crmStore.getLeads() : [];
    const sourceCounts = {};
    leads.forEach(l => {
      const src = l.source || 'Outros';
      sourceCounts[src] = (sourceCounts[src] || 0) + 1;
    });

    const labels = Object.keys(sourceCounts);
    const series = Object.values(sourceCounts);

    if (this.charts.sources) { try { this.charts.sources.destroy(); } catch(e){} }

    this.charts.sources = new ApexCharts(chartEl, {
      series: series.length ? series : [1],
      labels: labels.length ? labels : ['Sem dados'],
      chart: { type: 'donut', height: 310, fontFamily: "'Plus Jakarta Sans', sans-serif" },
      colors: ['#FF7A59', '#00A4BD', '#10B981', '#F59E0B', '#7D52F4', '#FA896B'],
      dataLabels: { enabled: true, style: { fontSize: '12px', fontWeight: 700 } },
      legend: { position: 'bottom', fontSize: '13px', fontWeight: 600, labels: { colors: '#334155' } }
    });
    this.charts.sources.render();
  }

  // ── RECEITA REAL POR MÊS ──────────────────────────────────────────────
  renderRevenueChart() {
    const chartEl = document.getElementById('revenue-trend-chart');
    if (!chartEl || !window.ApexCharts) return;

    const deals = window.crmStore ? window.crmStore.getDeals() : [];

    // Build last 6 months buckets
    const now   = new Date();
    const months = [];
    const labels = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push({ year: d.getFullYear(), month: d.getMonth() });
      labels.push(d.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }));
    }

    const totalByMonth = months.map(() => 0);
    const wonByMonth   = months.map(() => 0);

    deals.forEach(deal => {
      if (!deal.created_at) return;
      const dt = new Date(deal.created_at);
      const idx = months.findIndex(m => m.year === dt.getFullYear() && m.month === dt.getMonth());
      if (idx === -1) return;
      const val = parseFloat(deal.value) || 0;
      totalByMonth[idx] += val;
      if (deal.status === 'won' || deal.stage_id === 'stage-5') wonByMonth[idx] += val;
    });

    // If no real data at all, show zeros (not fake data)
    if (this.charts.revenue) { try { this.charts.revenue.destroy(); } catch(e){} }

    this.charts.revenue = new ApexCharts(chartEl, {
      series: [
        { name: 'Pipeline Total (R$)', data: totalByMonth },
        { name: 'Receita Ganha (R$)',  data: wonByMonth  }
      ],
      chart: { type: 'area', height: 320, fontFamily: "'Plus Jakarta Sans', sans-serif", toolbar: { show: false } },
      colors: ['#5D87FF', '#13DEB9'],
      stroke: { curve: 'smooth', width: 3 },
      fill: { type: 'gradient', gradient: { shadeIntensity: 1, opacityFrom: 0.4, opacityTo: 0.05 } },
      xaxis: {
        categories: labels,
        labels: { style: { colors: '#475569', fontSize: '12px', fontWeight: 600 } }
      },
      yaxis: {
        labels: {
          style: { colors: '#475569', fontSize: '12px', fontWeight: 600 },
          formatter: val => 'R$ ' + val.toLocaleString('pt-BR', { minimumFractionDigits: 0 })
        }
      },
      legend: { position: 'top', horizontalAlign: 'right', fontSize: '13px', fontWeight: 600 },
      tooltip: {
        y: { formatter: val => 'R$ ' + val.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) }
      }
    });
    this.charts.revenue.render();

    // Update won/lost stat cards if present
    const stats = this.getCRMStats();
    const setEl = (id, v) => { const el = document.getElementById(id); if (el) el.innerText = v; };
    setEl('stat-won-deals',  stats.wonDeals + ' fechados');
    setEl('stat-lost-deals', stats.lostDeals + ' perdidos');
  }
}

window.analyticsManager = new AnalyticsManager();
