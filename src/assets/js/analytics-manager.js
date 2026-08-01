/**
 * Metrifique-se CRM - Analytics & Dashboard Charts (ApexCharts High Contrast)
 * Calculates Funnel Conversion Rates, Lead Sources, and Pipeline Revenue.
 */

class AnalyticsManager {
  constructor() {
    this.init();
  }

  init() {
    document.addEventListener('DOMContentLoaded', () => {
      setTimeout(() => {
        this.renderMetricsCards();
        this.renderFunnelChart();
        this.renderSourcesChart();
        this.renderRevenueChart();
      }, 200);
    });
  }

  getCRMStats() {
    const leads = window.crmStore ? window.crmStore.getLeads() : [];
    const deals = window.crmStore ? window.crmStore.getDeals() : [];

    const totalLeads = leads.length;
    const mqlCount = leads.filter(l => l.lifecycle_stage === 'mql').length;
    const oppCount = leads.filter(l => l.lifecycle_stage === 'opportunity').length;
    const customerCount = leads.filter(l => l.lifecycle_stage === 'customer').length;

    const totalPipelineValue = deals.reduce((sum, d) => sum + (parseFloat(d.value) || 0), 0);
    const wonValue = deals.filter(d => d.status === 'won').reduce((sum, d) => sum + (parseFloat(d.value) || 0), 0);

    const conversionRate = totalLeads > 0 ? ((customerCount / totalLeads) * 100).toFixed(1) : '0.0';

    return {
      totalLeads,
      mqlCount,
      oppCount,
      customerCount,
      totalPipelineValue,
      wonValue,
      conversionRate
    };
  }

  renderMetricsCards() {
    const stats = this.getCRMStats();

    const totalLeadsEl = document.getElementById('stat-total-leads');
    if (totalLeadsEl) totalLeadsEl.innerText = stats.totalLeads;

    const conversionRateEl = document.getElementById('stat-conversion-rate');
    if (conversionRateEl) conversionRateEl.innerText = stats.conversionRate + '%';

    const pipelineValEl = document.getElementById('stat-pipeline-value');
    if (pipelineValEl) pipelineValEl.innerText = 'R$ ' + stats.totalPipelineValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 });

    const wonValEl = document.getElementById('stat-won-value');
    if (wonValEl) wonValEl.innerText = 'R$ ' + stats.wonValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 });
  }

  renderFunnelChart() {
    const chartEl = document.getElementById('funnel-chart');
    if (!chartEl || !window.ApexCharts) return;

    const stats = this.getCRMStats();

    const options = {
      series: [{
        name: "Contatos",
        data: [stats.totalLeads, stats.mqlCount, stats.oppCount, stats.customerCount]
      }],
      chart: {
        type: 'bar',
        height: 320,
        fontFamily: "'Plus Jakarta Sans', sans-serif",
        toolbar: { show: false }
      },
      plotOptions: {
        bar: {
          borderRadius: 8,
          horizontal: true,
          distributed: true,
          barHeight: '55%'
        }
      },
      colors: ['#FF7A59', '#00A4BD', '#F59E0B', '#10B981'],
      dataLabels: {
        enabled: true,
        style: {
          fontSize: '13px',
          fontWeight: 700,
          colors: ['#FFFFFF']
        },
        formatter: function (val, opt) {
          return opt.w.globals.labels[opt.dataPointIndex] + ": " + val;
        }
      },
      xaxis: {
        categories: ['Leads Capturados', 'MQL (Qualificados)', 'Oportunidades', 'Clientes Fechados'],
        labels: {
          style: {
            colors: '#475569',
            fontSize: '12px',
            fontWeight: 600
          }
        }
      },
      yaxis: {
        labels: {
          style: {
            colors: '#0F172A',
            fontSize: '13px',
            fontWeight: 700
          }
        }
      },
      legend: { show: false }
    };

    chartEl.innerHTML = '';
    const chart = new ApexCharts(chartEl, options);
    chart.render();
  }

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

    const options = {
      series: series.length ? series : [4, 3, 2, 1],
      labels: labels.length ? labels : ['Google Ads', 'Facebook Ads', 'Orgânico', 'Indicação'],
      chart: {
        type: 'donut',
        height: 310,
        fontFamily: "'Plus Jakarta Sans', sans-serif"
      },
      colors: ['#FF7A59', '#00A4BD', '#10B981', '#F59E0B'],
      dataLabels: {
        enabled: true,
        style: {
          fontSize: '12px',
          fontWeight: 700
        }
      },
      legend: {
        position: 'bottom',
        fontSize: '13px',
        fontWeight: 600,
        labels: {
          colors: '#334155'
        }
      }
    };

    chartEl.innerHTML = '';
    const chart = new ApexCharts(chartEl, options);
    chart.render();
  }

  renderRevenueChart() {
    const chartEl = document.getElementById('revenue-trend-chart');
    if (!chartEl || !window.ApexCharts) return;

    const options = {
      series: [{
        name: 'Previsão de Receita (R$)',
        data: [12000, 18500, 24000, 33400, 45900, 58000]
      }],
      chart: {
        type: 'area',
        height: 320,
        fontFamily: "'Plus Jakarta Sans', sans-serif",
        toolbar: { show: false }
      },
      colors: ['#FF7A59'],
      stroke: { curve: 'smooth', width: 3 },
      fill: {
        type: 'gradient',
        gradient: {
          shadeIntensity: 1,
          opacityFrom: 0.45,
          opacityTo: 0.05
        }
      },
      xaxis: {
        categories: ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun'],
        labels: {
          style: {
            colors: '#475569',
            fontSize: '12px',
            fontWeight: 600
          }
        }
      },
      yaxis: {
        labels: {
          style: {
            colors: '#475569',
            fontSize: '12px',
            fontWeight: 600
          },
          formatter: (val) => 'R$ ' + val.toLocaleString('pt-BR')
        }
      }
    };

    chartEl.innerHTML = '';
    const chart = new ApexCharts(chartEl, options);
    chart.render();
  }
}

window.analyticsManager = new AnalyticsManager();
