// Restringe o acesso ao site: somente os IPs abaixo conseguem abrir.
// Vercel Edge Middleware — sem `config.matcher`, roda em TODAS as requisicoes.
const ALLOWED_IPS = ['45.188.243.80'];

export default function middleware(request) {
  const xff = request.headers.get('x-forwarded-for') || '';
  const realIp = request.headers.get('x-real-ip') || '';
  const ip = (xff.split(',')[0] || realIp || '').trim();

  if (!ALLOWED_IPS.includes(ip)) {
    return new Response('Acesso restrito. Site liberado apenas para a rede autorizada.', {
      status: 403,
      headers: { 'content-type': 'text/plain; charset=utf-8' },
    });
  }
  // IP autorizado: sem retorno => segue para o conteudo.
}
