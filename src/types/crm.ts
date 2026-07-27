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
  organization?: Pick<Organization, 'id' | 'name' | 'archived_at'> | null;
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
  archived_at: string | null;
  stage_changed_at: string;
  created_at: string;
  updated_at: string;
  organization: Pick<Organization, 'id' | 'name' | 'status' | 'archived_at'> | null;
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
    >
  >;
