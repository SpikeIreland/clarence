-- ============================================================================
-- SCHEDULE REVIEW PHASE C: Seed Checklist Templates
-- Initial checklist questions for key schedule types across contract types.
-- ============================================================================

-- ============================================================================
-- SCOPE OF WORK
-- ============================================================================
INSERT INTO schedule_checklist_templates (contract_type_key, schedule_type, check_question, check_category, importance_level, display_order) VALUES
-- BPO
('bpo_agreement', 'scope_of_work', 'Are all in-scope services clearly listed?', 'completeness', 9, 1),
('bpo_agreement', 'scope_of_work', 'Are out-of-scope items explicitly excluded?', 'completeness', 8, 2),
('bpo_agreement', 'scope_of_work', 'Are deliverables and milestones defined?', 'operational', 8, 3),
('bpo_agreement', 'scope_of_work', 'Is there a process for scope change requests?', 'operational', 7, 4),
('bpo_agreement', 'scope_of_work', 'Are resource/staffing commitments specified?', 'operational', 7, 5),
('bpo_agreement', 'scope_of_work', 'Are transition/onboarding activities included?', 'operational', 8, 6),
-- IT Outsourcing
('it_outsourcing', 'scope_of_work', 'Are all in-scope services clearly listed?', 'completeness', 9, 1),
('it_outsourcing', 'scope_of_work', 'Are out-of-scope items explicitly excluded?', 'completeness', 8, 2),
('it_outsourcing', 'scope_of_work', 'Are supported technologies/platforms specified?', 'operational', 8, 3),
('it_outsourcing', 'scope_of_work', 'Is there a process for scope change requests?', 'operational', 7, 4),
('it_outsourcing', 'scope_of_work', 'Are transition/migration activities included?', 'operational', 8, 5),
-- SaaS
('saas_agreement', 'scope_of_work', 'Are product features and modules clearly defined?', 'completeness', 8, 1),
('saas_agreement', 'scope_of_work', 'Are usage limits or tiers specified?', 'commercial', 7, 2),
-- Managed Services
('managed_services', 'scope_of_work', 'Are all managed services clearly listed?', 'completeness', 9, 1),
('managed_services', 'scope_of_work', 'Are out-of-scope items explicitly excluded?', 'completeness', 8, 2),
('managed_services', 'scope_of_work', 'Are supported environments/platforms specified?', 'operational', 8, 3),
('managed_services', 'scope_of_work', 'Is there a change request process?', 'operational', 7, 4);

-- ============================================================================
-- PRICING
-- ============================================================================
INSERT INTO schedule_checklist_templates (contract_type_key, schedule_type, check_question, check_category, importance_level, display_order) VALUES
-- BPO
('bpo_agreement', 'pricing', 'Is a detailed rate card or pricing table included?', 'commercial', 9, 1),
('bpo_agreement', 'pricing', 'Is an annual indexation/price increase cap defined?', 'commercial', 9, 2),
('bpo_agreement', 'pricing', 'Are volume discount thresholds specified?', 'commercial', 7, 3),
('bpo_agreement', 'pricing', 'Is the invoicing frequency and payment mechanism clear?', 'commercial', 7, 4),
('bpo_agreement', 'pricing', 'Are there provisions for benchmarking or rate review?', 'commercial', 7, 5),
('bpo_agreement', 'pricing', 'Are additional/out-of-scope charges defined?', 'commercial', 8, 6),
-- IT Outsourcing
('it_outsourcing', 'pricing', 'Is a detailed rate card or pricing table included?', 'commercial', 9, 1),
('it_outsourcing', 'pricing', 'Is an annual indexation/price increase cap defined?', 'commercial', 9, 2),
('it_outsourcing', 'pricing', 'Are volume discount thresholds specified?', 'commercial', 7, 3),
('it_outsourcing', 'pricing', 'Is the invoicing frequency clear?', 'commercial', 7, 4),
('it_outsourcing', 'pricing', 'Are there provisions for benchmarking?', 'commercial', 7, 5),
-- SaaS
('saas_agreement', 'pricing', 'Are subscription tiers and pricing clearly defined?', 'commercial', 9, 1),
('saas_agreement', 'pricing', 'Is there a price increase notification period?', 'commercial', 8, 2),
('saas_agreement', 'pricing', 'Are overage charges defined?', 'commercial', 7, 3),
-- Managed Services
('managed_services', 'pricing', 'Is a detailed rate card included?', 'commercial', 9, 1),
('managed_services', 'pricing', 'Is an annual price increase cap defined?', 'commercial', 8, 2),
('managed_services', 'pricing', 'Are additional/out-of-scope charges defined?', 'commercial', 7, 3);

-- ============================================================================
-- SERVICE LEVELS
-- ============================================================================
INSERT INTO schedule_checklist_templates (contract_type_key, schedule_type, check_question, check_category, importance_level, display_order) VALUES
-- BPO
('bpo_agreement', 'service_levels', 'Are uptime/availability targets specified?', 'operational', 9, 1),
('bpo_agreement', 'service_levels', 'Are response time SLAs defined by severity?', 'operational', 8, 2),
('bpo_agreement', 'service_levels', 'Is the service credit mechanism defined?', 'commercial', 8, 3),
('bpo_agreement', 'service_levels', 'Is the SLA measurement methodology specified?', 'operational', 8, 4),
('bpo_agreement', 'service_levels', 'Are exclusion windows defined?', 'operational', 6, 5),
('bpo_agreement', 'service_levels', 'Is there a right to terminate for persistent SLA failure?', 'legal', 7, 6),
('bpo_agreement', 'service_levels', 'Are KPIs and reporting requirements defined?', 'operational', 7, 7),
-- IT Outsourcing
('it_outsourcing', 'service_levels', 'Are uptime/availability targets specified?', 'operational', 9, 1),
('it_outsourcing', 'service_levels', 'Are response time SLAs defined by severity?', 'operational', 8, 2),
('it_outsourcing', 'service_levels', 'Is the service credit mechanism defined?', 'commercial', 8, 3),
('it_outsourcing', 'service_levels', 'Is the SLA measurement methodology specified?', 'operational', 8, 4),
('it_outsourcing', 'service_levels', 'Are disaster recovery SLAs (RTO/RPO) defined?', 'operational', 8, 5),
-- SaaS
('saas_agreement', 'service_levels', 'Is uptime SLA target specified (e.g. 99.9%)?', 'operational', 9, 1),
('saas_agreement', 'service_levels', 'Are service credits defined for SLA breaches?', 'commercial', 8, 2),
('saas_agreement', 'service_levels', 'Is the measurement period defined (monthly/quarterly)?', 'operational', 7, 3),
('saas_agreement', 'service_levels', 'Are planned maintenance windows excluded from SLA?', 'operational', 6, 4),
-- Managed Services
('managed_services', 'service_levels', 'Are uptime/availability targets specified?', 'operational', 9, 1),
('managed_services', 'service_levels', 'Are response time SLAs defined by severity?', 'operational', 8, 2),
('managed_services', 'service_levels', 'Is the service credit mechanism defined?', 'commercial', 7, 3),
('managed_services', 'service_levels', 'Are KPIs and reporting requirements defined?', 'operational', 7, 4);

-- ============================================================================
-- DATA PROCESSING
-- ============================================================================
INSERT INTO schedule_checklist_templates (contract_type_key, schedule_type, check_question, check_category, importance_level, display_order) VALUES
-- BPO
('bpo_agreement', 'data_processing', 'Does it define the subject matter and purpose of processing?', 'legal', 9, 1),
('bpo_agreement', 'data_processing', 'Are categories of personal data specified?', 'legal', 9, 2),
('bpo_agreement', 'data_processing', 'Are data subject categories identified?', 'legal', 8, 3),
('bpo_agreement', 'data_processing', 'Is the data breach notification period defined?', 'legal', 9, 4),
('bpo_agreement', 'data_processing', 'Are sub-processor controls defined?', 'legal', 8, 5),
('bpo_agreement', 'data_processing', 'Are audit rights included?', 'legal', 7, 6),
('bpo_agreement', 'data_processing', 'Is there a data return/deletion obligation on termination?', 'legal', 8, 7),
-- IT Outsourcing
('it_outsourcing', 'data_processing', 'Does it define the purpose of processing?', 'legal', 9, 1),
('it_outsourcing', 'data_processing', 'Are categories of personal data specified?', 'legal', 9, 2),
('it_outsourcing', 'data_processing', 'Is the data breach notification period defined?', 'legal', 9, 3),
('it_outsourcing', 'data_processing', 'Are sub-processor controls defined?', 'legal', 8, 4),
('it_outsourcing', 'data_processing', 'Is there a data return/deletion obligation?', 'legal', 8, 5),
-- SaaS
('saas_agreement', 'data_processing', 'Does it define the purpose of processing?', 'legal', 9, 1),
('saas_agreement', 'data_processing', 'Are categories of personal data specified?', 'legal', 9, 2),
('saas_agreement', 'data_processing', 'Is the data breach notification period defined?', 'legal', 9, 3),
('saas_agreement', 'data_processing', 'Is there a list of approved sub-processors?', 'legal', 8, 4),
('saas_agreement', 'data_processing', 'Are international data transfer mechanisms addressed?', 'legal', 8, 5);

-- ============================================================================
-- GOVERNANCE
-- ============================================================================
INSERT INTO schedule_checklist_templates (contract_type_key, schedule_type, check_question, check_category, importance_level, display_order) VALUES
('bpo_agreement', 'governance', 'Is a steering committee structure defined?', 'operational', 8, 1),
('bpo_agreement', 'governance', 'Are meeting frequencies specified?', 'operational', 7, 2),
('bpo_agreement', 'governance', 'Is an escalation procedure defined?', 'operational', 8, 3),
('bpo_agreement', 'governance', 'Are reporting requirements specified?', 'operational', 7, 4),
('bpo_agreement', 'governance', 'Are named key contacts/representatives required?', 'operational', 6, 5);

-- ============================================================================
-- EXIT & TRANSITION
-- ============================================================================
INSERT INTO schedule_checklist_templates (contract_type_key, schedule_type, check_question, check_category, importance_level, display_order) VALUES
-- BPO
('bpo_agreement', 'exit_transition', 'Is a minimum transition/exit period defined?', 'operational', 9, 1),
('bpo_agreement', 'exit_transition', 'Is knowledge transfer to successor included?', 'operational', 8, 2),
('bpo_agreement', 'exit_transition', 'Is a data migration/return obligation defined?', 'legal', 9, 3),
('bpo_agreement', 'exit_transition', 'Are transition assistance charges capped or included?', 'commercial', 8, 4),
('bpo_agreement', 'exit_transition', 'Is continued service during transition required?', 'operational', 8, 5),
('bpo_agreement', 'exit_transition', 'Is data destruction certification required post-migration?', 'legal', 7, 6),
-- IT Outsourcing
('it_outsourcing', 'exit_transition', 'Is a minimum transition period defined?', 'operational', 9, 1),
('it_outsourcing', 'exit_transition', 'Is knowledge transfer included?', 'operational', 8, 2),
('it_outsourcing', 'exit_transition', 'Is a data migration obligation defined?', 'legal', 9, 3),
('it_outsourcing', 'exit_transition', 'Are transition costs capped?', 'commercial', 8, 4),
('it_outsourcing', 'exit_transition', 'Is continued service during transition required?', 'operational', 8, 5);

-- ============================================================================
-- DISASTER RECOVERY
-- ============================================================================
INSERT INTO schedule_checklist_templates (contract_type_key, schedule_type, check_question, check_category, importance_level, display_order) VALUES
('bpo_agreement', 'disaster_recovery', 'Are Recovery Time Objectives (RTO) defined?', 'operational', 9, 1),
('bpo_agreement', 'disaster_recovery', 'Are Recovery Point Objectives (RPO) defined?', 'operational', 9, 2),
('bpo_agreement', 'disaster_recovery', 'Is a DR testing schedule specified?', 'operational', 7, 3),
('bpo_agreement', 'disaster_recovery', 'Is a business continuity plan referenced?', 'operational', 7, 4),
('it_outsourcing', 'disaster_recovery', 'Are Recovery Time Objectives (RTO) defined?', 'operational', 9, 1),
('it_outsourcing', 'disaster_recovery', 'Are Recovery Point Objectives (RPO) defined?', 'operational', 9, 2),
('it_outsourcing', 'disaster_recovery', 'Is a DR testing schedule specified?', 'operational', 7, 3);

-- ============================================================================
-- INSURANCE
-- ============================================================================
INSERT INTO schedule_checklist_templates (contract_type_key, schedule_type, check_question, check_category, importance_level, display_order) VALUES
('bpo_agreement', 'insurance', 'Is Professional Indemnity cover specified?', 'legal', 8, 1),
('bpo_agreement', 'insurance', 'Is Public Liability cover specified?', 'legal', 7, 2),
('bpo_agreement', 'insurance', 'Is Cyber Insurance/Data Breach cover specified?', 'legal', 8, 3),
('bpo_agreement', 'insurance', 'Are minimum coverage amounts defined?', 'commercial', 7, 4),
('it_outsourcing', 'insurance', 'Is Professional Indemnity cover specified?', 'legal', 8, 1),
('it_outsourcing', 'insurance', 'Is Cyber Insurance cover specified?', 'legal', 8, 2);

-- ============================================================================
-- CHANGE CONTROL
-- ============================================================================
INSERT INTO schedule_checklist_templates (contract_type_key, schedule_type, check_question, check_category, importance_level, display_order) VALUES
('bpo_agreement', 'change_control', 'Is a formal change request process defined?', 'operational', 8, 1),
('bpo_agreement', 'change_control', 'Are change impact assessment requirements specified?', 'operational', 7, 2),
('bpo_agreement', 'change_control', 'Are approval thresholds/authorities defined?', 'operational', 7, 3),
('bpo_agreement', 'change_control', 'Is a change request template included?', 'completeness', 5, 4),
('it_outsourcing', 'change_control', 'Is a formal change request process defined?', 'operational', 8, 1),
('it_outsourcing', 'change_control', 'Are change impact assessment requirements specified?', 'operational', 7, 2);

-- ============================================================================
-- SECURITY
-- ============================================================================
INSERT INTO schedule_checklist_templates (contract_type_key, schedule_type, check_question, check_category, importance_level, display_order) VALUES
('it_outsourcing', 'security', 'Are security certification requirements specified (ISO 27001, SOC 2)?', 'legal', 8, 1),
('it_outsourcing', 'security', 'Are access control requirements defined?', 'operational', 8, 2),
('it_outsourcing', 'security', 'Is penetration testing frequency specified?', 'operational', 7, 3),
('it_outsourcing', 'security', 'Are incident response procedures defined?', 'operational', 8, 4),
('saas_agreement', 'security', 'Are security certifications specified (SOC 2, ISO 27001)?', 'legal', 8, 1),
('saas_agreement', 'security', 'Are encryption standards defined (at rest and in transit)?', 'operational', 8, 2),
('saas_agreement', 'security', 'Is penetration testing frequency specified?', 'operational', 7, 3);
