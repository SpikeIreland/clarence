{
  "documentType": "Playbook Compliance Report",
  "reportTitle": "Playbook Compliance Report",
  "contractName": "IT Services Agreement 2026",
  "contractType": "Service Agreement",
  "generatedDate": "5 March 2026",
  "generatedTime": "14:30",

  "initiatorCompany": "Acme Corp",
  "initiatorName": "Jane Smith",
  "respondentCompany": "TechServ Ltd",
  "respondentName": "John Provider",

  "playbookName": "Enterprise IT Procurement v2.1",
  "companyName": "Acme Corp",

  "overallScore": 72,
  "scoreColour": "#f59e0b",
  "scoreLabel": "Partially Compliant",

  "rulesPassed": 14,
  "rulesWarning": 4,
  "rulesFailed": 3,
  "totalRules": 21,

  "hasBreaches": true,
  "redLineBreaches": 1,
  "redLineTotal": 5,

  "redLines": [
    {
      "rule": "Liability cap must be >= 200% of annual fees",
      "status": "PASS",
      "statusColour": "#10b981",
      "detail": "Liability capped at 200% of fees — meets minimum threshold.",
      "clause": "Limitation of Liability (5.1)"
    },
    {
      "rule": "No uncapped indemnities",
      "status": "BREACH",
      "statusColour": "#ef4444",
      "detail": "IP indemnity in clause 8.3 has no cap specified. This breaches the playbook requirement for all indemnities to have a monetary cap.",
      "clause": "Intellectual Property (8.3)"
    },
    {
      "rule": "Termination for convenience >= 90 days notice",
      "status": "PASS",
      "statusColour": "#10b981",
      "detail": "90 days notice period for termination for convenience — meets requirement.",
      "clause": "Termination (12.1)"
    },
    {
      "rule": "GDPR data processing addendum required",
      "status": "PASS",
      "statusColour": "#10b981",
      "detail": "DPA included as Schedule 4 with all required clauses.",
      "clause": "Data Protection (9.1)"
    },
    {
      "rule": "Governing law must be England & Wales",
      "status": "PASS",
      "statusColour": "#10b981",
      "detail": "English law and jurisdiction confirmed.",
      "clause": "Governing Law (15.1)"
    }
  ],

  "categories": [
    {
      "name": "Liability & Risk",
      "score": 65,
      "status": "Warning",
      "statusColour": "#f59e0b",
      "ruleCount": 5,
      "detail": "IP indemnity clause needs cap. Other liability provisions compliant."
    },
    {
      "name": "Commercial Terms",
      "score": 85,
      "status": "Good",
      "statusColour": "#10b981",
      "ruleCount": 6,
      "detail": "Fee review mechanism and payment terms within acceptable ranges."
    },
    {
      "name": "Data & Security",
      "score": 90,
      "status": "Good",
      "statusColour": "#10b981",
      "ruleCount": 4,
      "detail": "Full GDPR compliance. Data processing addendum included."
    },
    {
      "name": "Term & Termination",
      "score": 78,
      "status": "Good",
      "statusColour": "#10b981",
      "ruleCount": 3,
      "detail": "Notice periods compliant. Auto-renewal terms within range."
    },
    {
      "name": "Intellectual Property",
      "score": 40,
      "status": "Fail",
      "statusColour": "#ef4444",
      "ruleCount": 3,
      "detail": "Uncapped IP indemnity and broad assignment clause need review."
    }
  ],

  "flexibility": [
    {
      "clause": "Limitation of Liability",
      "category": "Liability & Risk",
      "currentPosition": "4",
      "playbookMin": "3",
      "playbookMax": "5",
      "withinRange": true,
      "statusColour": "#10b981",
      "statusLabel": "Within range"
    },
    {
      "clause": "Payment Terms",
      "category": "Commercial Terms",
      "currentPosition": "5",
      "playbookMin": "4",
      "playbookMax": "6",
      "withinRange": true,
      "statusColour": "#10b981",
      "statusLabel": "Within range"
    },
    {
      "clause": "IP Assignment",
      "category": "Intellectual Property",
      "currentPosition": "7",
      "playbookMin": "2",
      "playbookMax": "5",
      "withinRange": false,
      "statusColour": "#ef4444",
      "statusLabel": "Outside range"
    },
    {
      "clause": "Termination Notice",
      "category": "Term & Termination",
      "currentPosition": "5",
      "playbookMin": "4",
      "playbookMax": "6",
      "withinRange": true,
      "statusColour": "#10b981",
      "statusLabel": "Within range"
    },
    {
      "clause": "Data Breach Notification",
      "category": "Data & Security",
      "currentPosition": "3",
      "playbookMin": "2",
      "playbookMax": "4",
      "withinRange": true,
      "statusColour": "#10b981",
      "statusLabel": "Within range"
    },
    {
      "clause": "Fee Escalation Cap",
      "category": "Commercial Terms",
      "currentPosition": "6",
      "playbookMin": "3",
      "playbookMax": "5",
      "withinRange": false,
      "statusColour": "#ef4444",
      "statusLabel": "Outside range"
    }
  ],

  "footer": {
    "clarence_version": "1.0",
    "document_id": "b2c3d4e5-f6a7-8901-bcde-f12345678901",
    "confidentiality": "CONFIDENTIAL — Initiator eyes only. Not shared with counterparty."
  }
}
