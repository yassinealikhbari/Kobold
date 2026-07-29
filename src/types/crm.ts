export type CrmLanguage = 'de' | 'it' | 'en';
export type OrganizationOrigin =
  | 'manual'
  | 'walk_by'
  | 'referral'
  | 'inbound'
  | 'event'
  | 'other';
export type OrganizationStatus =
  | 'prospect'
  | 'active'
  | 'dormant'
  | 'closed'
  | 'disqualified';

export type Organization = {
  id: string;
  name: string;
  website: string | null;
  industry: string | null;
  district: string | null;
  postcode: string | null;
  country: string;
  language: CrmLanguage;
  origin: OrganizationOrigin;
  status: OrganizationStatus;
  notes: string | null;
  address: string | null;
  lead_score: number | null;
  lead_score_reason: string | null;
  missing_function: string | null;
  staleness_evidence: string | null;
  hook_verified: string | null;
  source_place_id: string | null;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
};

export type Contact = {
  id: string;
  organization_id: string | null;
  full_name: string;
  role: string | null;
  email: string | null;
  phone: string | null;
  instagram: string | null;
  linkedin: string | null;
  language: CrmLanguage | null;
  is_primary: boolean;
  notes: string | null;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
  organization?: Pick<Organization, 'id' | 'name' | 'district' | 'language' | 'archived_at'> | null;
};

export type OrganizationDraft = Pick<Organization, 'name'> &
  Partial<
    Pick<
      Organization,
      | 'website'
      | 'industry'
      | 'district'
      | 'postcode'
      | 'country'
      | 'language'
      | 'origin'
      | 'status'
      | 'notes'
      | 'address'
      | 'lead_score'
      | 'lead_score_reason'
      | 'missing_function'
      | 'staleness_evidence'
      | 'hook_verified'
      | 'source_place_id'
    >
  >;

export type ContactDraft = Pick<Contact, 'full_name'> &
  Partial<
    Pick<
      Contact,
      | 'organization_id'
      | 'role'
      | 'email'
      | 'phone'
      | 'instagram'
      | 'linkedin'
      | 'language'
      | 'is_primary'
      | 'notes'
    >
  >;

export type OrganizationFilters = {
  q: string;
  status: OrganizationStatus | '';
  language: CrmLanguage | '';
  district: string;
  has_website: '' | 'true' | 'false';
  archived: boolean;
};

export type OpportunityStage =
  | 'lead'
  | 'contacted'
  | 'conversation'
  | 'proposal'
  | 'won'
  | 'lost';
export type OpportunityLostReason =
  | 'no budget'
  | 'no response'
  | 'timing'
  | 'chose someone else'
  | 'not a fit'
  | 'business closed';

export type Opportunity = {
  id: string;
  organization_id: string;
  title: string;
  stage: OpportunityStage;
  value_cents: number | null;
  currency: string;
  confidence: number | null;
  expected_close: string | null;
  lost_reason: OpportunityLostReason | null;
  draft_email_subject: string | null;
  draft_email_body: string | null;
  archived_at: string | null;
  stage_changed_at: string;
  created_at: string;
  updated_at: string;
  organization: Pick<Organization, 'id' | 'name' | 'status' | 'archived_at' | 'missing_function'> | null;
  open_task_count?: number;
};

export type OpportunityDraft = Pick<Opportunity, 'organization_id' | 'title'> &
  Partial<
    Pick<
      Opportunity,
      | 'stage'
      | 'value_cents'
      | 'currency'
      | 'confidence'
      | 'expected_close'
      | 'lost_reason'
      | 'draft_email_subject'
      | 'draft_email_body'
    >
  >;

export type SubjectType = 'organization' | 'contact' | 'opportunity' | 'application';
export type ActivityKind =
  | 'note'
  | 'visit'
  | 'dm'
  | 'email'
  | 'call'
  | 'meeting'
  | 'proposal'
  | 'stage_change'
  | 'system';

export type Activity = {
  id: string;
  subject_type: SubjectType;
  subject_id: string;
  subject_label: string;
  subject_path: string;
  kind: ActivityKind;
  body: string | null;
  metadata: Record<string, unknown>;
  occurred_at: string;
  created_at: string;
};

export type Task = {
  id: string;
  subject_type: SubjectType | null;
  subject_id: string | null;
  subject_label: string | null;
  subject_path: string | null;
  mode: 'freelance' | 'jobs' | null;
  title: string;
  due_at: string | null;
  done_at: string | null;
  created_at: string;
  updated_at: string;
};

export type SiteAudit = {
  id: string;
  organization_id: string | null;
  requested_url: string;
  final_url: string | null;
  status: 'completed' | 'failed';
  http_status: number | null;
  https: boolean | null;
  response_ms: number | null;
  charset: string | null;
  mojibake_detected: boolean | null;
  viewport_meta: boolean | null;
  page_weight_bytes: number | null;
  generator: string | null;
  cms: string | null;
  has_impressum: boolean | null;
  has_datenschutz: boolean | null;
  has_open_graph: boolean | null;
  last_modified: string | null;
  page_title: string | null;
  error: string | null;
  audited_at: string;
  created_at: string;
};

export type MessageTemplate = {
  id: string;
  template_key: string;
  title: string;
  channel: 'dm' | 'email' | 'whatsapp' | 'in_person';
  language: CrmLanguage;
  body: string;
  variables: string[];
  archived_at: string | null;
  created_at: string;
  updated_at: string;
};
