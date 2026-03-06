# certify-next-clause Workflow Update — Position Scale Context

## Problem

The `certify-next-clause` workflow generates `clarenceAssessment` text without knowing the position scale direction or party labels. This causes assessments like "favours the disclosing party" for both position 4 (flexible end) and position 7 (protective end), which is contradictory.

## What Changed in the Codebase

The frontend now sends two additional fields in the webhook payload:

```json
{
    "contract_id": "uuid",
    "contract_type_key": "nda_mutual",
    "initiator_party_role": "protected"
}
```

These fields may be `null` for older contracts. The workflow must handle this gracefully.

## Changes to Apply in n8n

### 1. Extract Context from Webhook Input

In the first Code node after the Webhook trigger, extract the new fields:

```javascript
const contractId = $input.first().json.contract_id;
const contractTypeKey = $input.first().json.contract_type_key || null;
const initiatorPartyRole = $input.first().json.initiator_party_role || null;

return [{ json: { contractId, contractTypeKey, initiatorPartyRole } }];
```

### 2. Add DB Fallback Lookup

If `contract_type_key` is not provided (older frontend, direct API call), query the database:

```sql
SELECT contract_type_key, initiator_party_role
FROM uploaded_contracts
WHERE contract_id = '{{ $json.contractId }}'::uuid
LIMIT 1;
```

Merge the result: use the webhook value if present, otherwise use the DB value.

### 3. Party Label Lookup Table

Add this lookup table to the Code node that builds the Claude prompt. This maps `contract_type_key` to the party labels used in the position scale:

```javascript
const PARTY_LABELS = {
    'service_agreement':      { protected: 'Customer',         providing: 'Provider' },
    'saas_agreement':         { protected: 'Subscriber',       providing: 'Provider' },
    'it_outsourcing':         { protected: 'Customer',         providing: 'Provider' },
    'bpo_agreement':          { protected: 'Customer',         providing: 'Provider' },
    'managed_services':       { protected: 'Customer',         providing: 'Provider' },
    'consultancy_agreement':  { protected: 'Client',           providing: 'Consultant' },
    'software_license':       { protected: 'Licensee',         providing: 'Licensor' },
    'maintenance_agreement':  { protected: 'Customer',         providing: 'Service Provider' },
    'nda_one_way':            { protected: 'Disclosing Party', providing: 'Receiving Party' },
    'nda_mutual':             { protected: 'Party A',          providing: 'Party B' },
    'lease_agreement':        { protected: 'Tenant',           providing: 'Landlord' },
    'loan_agreement':         { protected: 'Borrower',         providing: 'Lender' },
    'insurance_policy':       { protected: 'Policyholder',     providing: 'Insurer' },
    'sales_agreement':        { protected: 'Buyer',            providing: 'Seller' },
    'purchase_agreement':     { protected: 'Buyer',            providing: 'Seller' },
    'distribution_agreement': { protected: 'Distributor',      providing: 'Supplier' },
    'franchise_agreement':    { protected: 'Franchisee',       providing: 'Franchisor' },
    'employment_contract':    { protected: 'Employee',         providing: 'Employer' },
    'construction_contract':  { protected: 'Client',           providing: 'Contractor' },
    'agency_agreement':       { protected: 'Principal',        providing: 'Agent' },
};

const labels = PARTY_LABELS[contractTypeKey] || { protected: 'Protected Party', providing: 'Providing Party' };
const protectedLabel = labels.protected;
const providingLabel = labels.providing;
```

### 4. Add Position Scale Context to the Claude Prompt

In the Code node that builds the system prompt for each clause's certification, add this block **before** the clause text:

```
POSITION SCALE (YOU MUST FOLLOW THIS):
- Position 1: Maximum flexibility for ${providingLabel}
- Position 2: Strong ${providingLabel} terms
- Position 3: ${providingLabel}-leaning but reasonable
- Position 4: Slight ${providingLabel} advantage
- Position 5: Balanced / Market standard
- Position 6: Slight ${protectedLabel} advantage
- Position 7: Moderate protection for ${protectedLabel}
- Position 8: Strong protection for ${protectedLabel}
- Position 9: Very high protection for ${protectedLabel}
- Position 10: Maximum protection for ${protectedLabel}

CRITICAL RULES:
- The clarencePosition number you assign and the clarenceAssessment text MUST be consistent.
- If you assign position 7, the assessment MUST say it favours/protects ${protectedLabel}.
- If you assign position 3, the assessment MUST say it favours ${providingLabel}.
- If you assign position 5, the assessment MUST say it is balanced or market standard.
- NEVER say a low position (1-4) favours the protected party.
- NEVER say a high position (7-10) favours the providing party.
- Use the party labels above (${protectedLabel}/${providingLabel}), not generic terms.
```

### 5. Verify temperature=0

Ensure the Claude API call in this workflow uses `temperature: 0` to produce deterministic assessments.

## Testing

After applying these changes:

1. Upload a **Mutual NDA** (`nda_mutual`). Check that:
   - A clause certified at position 7 says "moderate protection for Party A"
   - A clause certified at position 4 says "slight advantage for Party B"
   - These NEVER both say the same party

2. Upload a **Service Agreement** (`service_agreement`). Check that:
   - Assessments use "Customer" and "Provider", not "disclosing party" or generic terms

3. Upload a contract **without a contract_type_key** set. Check that:
   - The DB fallback lookup retrieves the type
   - If no type exists, generic "Protected Party" / "Providing Party" labels are used
   - The workflow does NOT crash
