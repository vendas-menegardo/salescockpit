type AppRole = "admin" | "user";

type UserPolicyInput = {
  activeAdminCount: number;
  currentRole: string | null | undefined;
  currentUserId: string;
  nextActive: boolean;
  nextRole: AppRole;
  targetUserId: string;
  targetWasActive: boolean;
};

export function validateUserUpdatePolicy(input: UserPolicyInput) {
  const isSelf = input.currentUserId === input.targetUserId;
  const targetWasActiveAdmin =
    input.targetWasActive && input.currentRole === "admin";
  const targetWillBeActiveAdmin =
    input.nextActive && input.nextRole === "admin";

  if (isSelf && !targetWillBeActiveAdmin) {
    return "Você não pode desativar ou remover seu próprio acesso administrativo.";
  }

  if (
    targetWasActiveAdmin &&
    !targetWillBeActiveAdmin &&
    input.activeAdminCount <= 1
  ) {
    return "O último administrador ativo não pode ser desativado ou rebaixado.";
  }

  return null;
}
