exports.handler = async (event) => {
  const cuit = event.queryStringParameters?.cuit
  if (!cuit) {
    return { statusCode: 400, body: JSON.stringify({ error: 'CUIT requerido' }) }
  }
  try {
    const response = await fetch(
      `https://api.bcra.gob.ar/CentralDeDeudores/v1.0/Deudas/${cuit}`,
      { headers: { Accept: 'application/json', 'User-Agent': 'Mozilla/5.0' } }
    )
    const data = await response.json()
    return {
      statusCode: response.status,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify(data)
    }
  } catch (e) {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Error consultando BCRA' })
    }
  }
}
