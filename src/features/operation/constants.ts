import type {
  CommercialStage,
  CompanyQualification,
  ContactType,
  ContactValidity,
  InteractionResult,
} from "@prisma/client";

export const COMMERCIAL_STAGE_LABELS: Record<CommercialStage, string> = {
  NOVA: "Nova",
  EM_TENTATIVA: "Em tentativa",
  CONTATO_REALIZADO: "Contato realizado",
  QUALIFICADA: "Qualificada",
  REUNIAO_AGENDADA: "Reunião agendada",
  REUNIAO_REALIZADA: "Reunião realizada",
  GANHA: "Ganha",
  PERDIDA: "Perdida",
  CONGELADA: "Congelada",
  DESCARTADA: "Descartada",
};

export const INTERACTION_RESULT_LABELS: Record<InteractionResult, string> = {
  ATENDEU: "Atendeu",
  SEM_RESPOSTA: "Sem resposta",
  OCUPADO: "Ocupado",
  CAIXA_POSTAL: "Caixa postal",
  NUMERO_INVALIDO: "Número inválido",
  NUMERO_ERRADO: "Número errado",
  NUMERO_INEXISTENTE: "Número inexistente",
  ERRO_TECNICO: "Erro técnico",
  PESSOA_ERRADA: "Atendeu outra pessoa",
  RECEPCAO: "Recepção ou portaria",
  RESPONSAVEL_INDISPONIVEL: "Responsável indisponível",
  SOLICITOU_RETORNO: "Solicitou retorno",
  FALOU_COM_RESPONSAVEL: "Falou com responsável",
  SEM_INTERESSE: "Sem interesse",
  EMPRESA_INADEQUADA: "Empresa inadequada",
  EMPRESA_QUALIFICADA: "Empresa qualificada",
  REUNIAO_AGENDADA: "Reunião agendada",
  EMAIL_PREPARADO: "E-mail preparado",
  EMAIL_ENVIADO: "E-mail enviado",
  EMAIL_RESPOSTA: "Resposta por e-mail",
  WHATSAPP_PREPARADO: "WhatsApp preparado",
  WHATSAPP_ENVIADO: "WhatsApp enviado",
};

export const CALL_INTERACTION_RESULTS: InteractionResult[] = [
  "ATENDEU",
  "SEM_RESPOSTA",
  "CAIXA_POSTAL",
  "OCUPADO",
  "NUMERO_ERRADO",
  "NUMERO_INEXISTENTE",
  "ERRO_TECNICO",
  "PESSOA_ERRADA",
  "RECEPCAO",
  "RESPONSAVEL_INDISPONIVEL",
  "SOLICITOU_RETORNO",
  "FALOU_COM_RESPONSAVEL",
  "SEM_INTERESSE",
  "EMPRESA_INADEQUADA",
  "EMPRESA_QUALIFICADA",
  "REUNIAO_AGENDADA",
];

export const COMPANY_QUALIFICATION_LABELS: Record<
  CompanyQualification,
  string
> = {
  EM_OPERACAO: "Em operação",
  ATUALIZAR_CONTATO: "Atualizar contato",
  CONGELADA: "Congelada",
  PERDIDA: "Perdida",
  INAPTA: "Inapta",
};

export const CONTACT_TYPE_LABELS: Record<ContactType, string> = {
  PHONE: "Telefone",
  WHATSAPP: "WhatsApp",
  EMAIL: "E-mail",
  WEBSITE: "Site",
  INSTAGRAM: "Instagram",
  OTHER: "Outro",
};

export const CONTACT_VALIDITY_LABELS: Record<ContactValidity, string> = {
  UNKNOWN: "Não verificado",
  VALID: "Válido",
  INVALID: "Inválido",
};

export const OPERATION_VIEWS = [
  { value: "not-worked", label: "Não trabalhadas" },
  { value: "attempting", label: "Em tentativa" },
  { value: "returns-today", label: "Retornos hoje" },
  { value: "overdue", label: "Atrasados" },
  { value: "qualified", label: "Qualificadas" },
  { value: "meetings", label: "Reuniões" },
  { value: "frozen", label: "Congeladas" },
] as const;

export type OperationView = (typeof OPERATION_VIEWS)[number]["value"];

export function isOperationView(value: string): value is OperationView {
  return OPERATION_VIEWS.some((item) => item.value === value);
}
