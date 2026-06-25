// Restringe o acesso ao site: somente os IPs abaixo conseguem abrir.
// Roda na Edge da Vercel, antes de servir qualquer arquivo estatico.
export const config = {
  matcher: '/:path*',
};

const ALLOWED_IPS = ['45.188.243.80'];

export default function middleware(request) {
  const realIp = request.headers.get('x-real-ip') || '';
  const xff = request.headers.get('x-forwarded-for') || '';
  const ip = (realIp || xff.split(',')[0] || '').trim();

  if (!ALLOWED_IPS.includes(ip)) {
    return new Response(
      'Acesso restrito. Este site so pode ser acessado pela rede autorizada.',
      { status: 403, headers: { 'content-type': 'text/plain; charset=utf-8' } }
    );
  }
  // Sem retorno => segue para o conteudo.
}
