export type AssigneeRule = {
  taskKey: string;
  label: string;
  assigneeGid: string;
  assigneeName: string;
};

export type CustomFieldConfig = {
  statusFieldGid: string;
  statusProgressGid: string;
  taskTypeFieldGid: string;
  taskTypeMdGid: string;
  taskTypePcGid: string;
  taskTypeUpdateGid: string;
  taskTypeOpenGid: string;
  taskTypeVmdGid: string;
  taskTypeEtcGid: string;
  eventTypeFieldGid: string;
};

export type BenefitKeyword = {
  keyword: string;
  enabled: boolean;
};

export type PcExcludeKeyword = {
  keyword: string;
  enabled: boolean;
};

export type HandwritingKeyword = {
  keyword: string;
  enabled: boolean;
};

export type VmdConditionLabel = {
  label: string;
  enabled: boolean;
};

export type AppConfig = {
  version: number;
  defaultProjectGid: string;
  defaultWorkspaceGid: string;

  assigneeRules: AssigneeRule[];
  customFields: CustomFieldConfig;

  benefitKeywords: BenefitKeyword[];
  pcExcludeKeywords: PcExcludeKeyword[];
  handwritingKeywords: HandwritingKeyword[];
  vmdConditionLabels: VmdConditionLabel[];

  dueDaysOffset: number;
  vmdItemCount: number;

  taskNames: {
    winner: string;
    vmd: string;
    vmdSub: string;
    md: string;
    pc: string;
    sp: string;
    update: string;
    updateSub: string;
    open: string;
    openDesign: string;
  };

  adminPasswordHash: string;
};
