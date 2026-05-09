export default async function handler(req, res) {
  const key = process.env.THINGSPEAK_API_KEY;
  const ch  = process.env.THINGSPEAK_CH_ID;
  const n   = req.query.n || 60; // quantidade de pontos, vem do frontend

  try {
    const resp = await fetch(
      `https://api.thingspeak.com/channels/${ch}/feeds.json?api_key=${key}&results=${n}`
    );
    const data = await resp.json();
    res.status(200).json(data);
  } catch (e) {
    res.status(500).json({ error: 'Erro ao buscar histórico' });
  }
}