export async function onRequest(context) {
  const { request, env } = context;

  // CORS preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders() });
  }

  // Password check
  const url = new URL(request.url);
  const pw = url.searchParams.get('pw') || '';
  if (pw !== (env.ADMIN_PASSWORD || 'Babsi')) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json', ...corsHeaders() },
    });
  }

  const accountId = env.CF_ACCOUNT_ID || '95c7f52e068f9f2f04f56a3682349a3f';
  const token = env.CF_API_TOKEN;

  if (!token) {
    return new Response(JSON.stringify({ error: 'CF_API_TOKEN not set' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders() },
    });
  }

  const today = new Date();
  const d30ago = new Date(today);
  d30ago.setDate(d30ago.getDate() - 29);
  const dateEnd = today.toISOString().slice(0, 10);
  const dateStart = d30ago.toISOString().slice(0, 10);

  const query = `{
    viewer {
      accounts(filter: {accountTag: "${accountId}"}) {
        byDay: httpRequestsAdaptiveGroups(
          limit: 30,
          filter: { date_geq: "${dateStart}", date_leq: "${dateEnd}", clientRequestHTTPHost_like: "%barbarafriehs%" },
          orderBy: [date_ASC]
        ) {
          count
          sum { visits }
          dimensions { date }
        }
        byCountry: httpRequestsAdaptiveGroups(
          limit: 10,
          filter: { date_geq: "${dateStart}", date_leq: "${dateEnd}", clientRequestHTTPHost_like: "%barbarafriehs%" },
          orderBy: [sum_visits_DESC]
        ) {
          sum { visits }
          dimensions { clientCountryName }
        }
      }
    }
  }`;

  const resp = await fetch('https://api.cloudflare.com/client/v4/graphql', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query }),
  });

  const data = await resp.json();

  return new Response(JSON.stringify(data), {
    headers: { 'Content-Type': 'application/json', ...corsHeaders() },
  });
}

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
  };
}
