export default async function handler(req, res) {
  const { cuit } = req.query
  if (!cuit) return res.status(400).json({ error: 'CUIT requerido' })
  try {
    const response = await fetch(
      `https://api.bcra.gob.ar/CentralDeDeudores/v1.0/Deudas/${cuit}`,
      { headers: { Accept: 'application/json', 'User-Agent': 'Mozilla/5.0' } }
    )
    const data = await response.json()
    res.status(response.status).json(data)
  } catch (e) {
    res.status(500).json({ error: 'Error consultando BCRA' })
  }
}
