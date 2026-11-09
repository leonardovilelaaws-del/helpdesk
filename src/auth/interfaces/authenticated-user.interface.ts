// Este é o usuário que controllers e guards recebem depois da autenticação.
// Separamos do modelo do banco para não levar senha e tokens às respostas.
export interface AuthenticatedUser {
  id: string;
  name: string;
  email: string;
  // Role é um perfil, como CREDITO; o usuário pode acumular mais de um.
  roles: string[];
  // Permissão é uma ação, como credito:read. Aqui juntamos as ações de todas as roles.
  permissions: string[];
  // sessionId liga este acesso ao login salvo no banco, que pode ser encerrado antes do JWT vencer.
  sessionId: string;
}
