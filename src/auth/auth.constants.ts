// Quem grava, lê ou apaga um cookie precisa usar exatamente o mesmo nome.
export const ACCESS_COOKIE = 'access_token';
export const REFRESH_COOKIE = 'refresh_token';
// O access curto limita seu tempo de uso; o refresh mantém o login por até sete dias.
// Usamos segundos porque esse é o formato esperado pelo JWT e pelos cookies nativos.
export const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;
export const REFRESH_TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60;
