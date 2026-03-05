<!-- ================================================================== -->
<!-- 6.6Q PLAYBOOK COMPLIANCE REPORT - TEMPLATE TAB                     -->
<!-- CLARENCE Quick Contract Document Centre                            -->
<!-- APITemplate.io - Jinja2/HTML                                       -->
<!-- ================================================================== -->

<!-- ================================================================== -->
<!-- SECTION 1: TITLE BLOCK                                             -->
<!-- ================================================================== -->
<div class="title-block">
    <h1>Playbook Compliance Report</h1>
    <div class="parties-headline">
        <span class="party-name initiator">{{ initiatorCompany | default("Company") }}</span>
        <span class="connector">&harr;</span>
        <span class="party-name respondent">{{ respondentCompany | default("Counterparty") }}</span>
    </div>
    <div class="contract-type-label">{{ contractType | default("Service Agreement") }} &mdash; {{ playbookName | default("Playbook") }}</div>
    <div class="generated-date">
        Report generated {{ generatedDate | default("—") }} at {{ generatedTime | default("—") }}
    </div>
    <div class="privacy-notice">
        <span class="lock-icon">&#128274;</span>
        This report is confidential to {{ companyName | default("your organisation") }} and is not shared with the counterparty.
    </div>
</div>

<!-- ================================================================== -->
<!-- SECTION 2: OVERALL COMPLIANCE SCORE                                -->
<!-- ================================================================== -->
<div class="section">
    <h2>Overall Compliance</h2>
    <div class="score-card">
        <div class="score-ring-container">
            <div class="score-ring" style="border-color: {{ scoreColour | default('#10b981') }};">
                <span class="score-number" style="color: {{ scoreColour | default('#10b981') }};">{{ overallScore | default(0) }}</span>
                <span class="score-unit">%</span>
            </div>
            <div class="score-label" style="color: {{ scoreColour | default('#10b981') }};">{{ scoreLabel | default("—") }}</div>
        </div>
        <div class="score-breakdown">
            <div class="snapshot-grid">
                <div class="snapshot-item passed">
                    <div class="snapshot-value">{{ rulesPassed | default(0) }}</div>
                    <div class="snapshot-label">Passed</div>
                </div>
                <div class="snapshot-item warning">
                    <div class="snapshot-value">{{ rulesWarning | default(0) }}</div>
                    <div class="snapshot-label">Warnings</div>
                </div>
                <div class="snapshot-item failed">
                    <div class="snapshot-value">{{ rulesFailed | default(0) }}</div>
                    <div class="snapshot-label">Failed</div>
                </div>
                <div class="snapshot-item total">
                    <div class="snapshot-value">{{ totalRules | default(0) }}</div>
                    <div class="snapshot-label">Total Rules</div>
                </div>
            </div>
        </div>
    </div>
</div>

<!-- ================================================================== -->
<!-- SECTION 3: RED LINE BREACHES                                       -->
<!-- ================================================================== -->
<div class="section">
    <h2>Red Lines{% if hasBreaches %} <span class="breach-badge">{{ redLineBreaches }} BREACH{{ 'ES' if redLineBreaches > 1 else '' }}</span>{% endif %}</h2>
    <p class="section-subtitle">Non-negotiable rules that must not be violated. {{ redLineTotal | default(0) }} red line rule{{ 's' if redLineTotal != 1 else '' }} checked.</p>

    {% if redLines and redLines | length > 0 %}
    <table class="compliance-table">
        <thead>
            <tr>
                <th class="col-status">Status</th>
                <th class="col-rule">Rule</th>
                <th class="col-clause">Clause</th>
                <th class="col-detail">Detail</th>
            </tr>
        </thead>
        <tbody>
            {% for rl in redLines %}
            <tr>
                <td class="col-status">
                    <span class="status-badge" style="background: {{ rl.statusColour }}20; color: {{ rl.statusColour }};">{{ rl.status }}</span>
                </td>
                <td class="col-rule">{{ rl.rule }}</td>
                <td class="col-clause">{{ rl.clause | default("—") }}</td>
                <td class="col-detail">{{ rl.detail | default("—") }}</td>
            </tr>
            {% endfor %}
        </tbody>
    </table>
    {% else %}
    <div class="empty-state">No red line rules defined in this playbook.</div>
    {% endif %}
</div>

<!-- ================================================================== -->
<!-- SECTION 4: CATEGORY COMPLIANCE                                     -->
<!-- ================================================================== -->
<div class="section">
    <h2>Category Compliance</h2>
    <p class="section-subtitle">Compliance scores grouped by contract category.</p>

    {% if categories and categories | length > 0 %}
    <table class="compliance-table">
        <thead>
            <tr>
                <th class="col-category">Category</th>
                <th class="col-score">Score</th>
                <th class="col-status">Status</th>
                <th class="col-rules">Rules</th>
                <th class="col-detail">Detail</th>
            </tr>
        </thead>
        <tbody>
            {% for cat in categories %}
            <tr>
                <td class="col-category">{{ cat.name }}</td>
                <td class="col-score">
                    <div class="mini-bar-container">
                        <div class="mini-bar" style="width: {{ cat.score }}%; background: {{ cat.statusColour }};"></div>
                    </div>
                    <span class="score-text">{{ cat.score }}%</span>
                </td>
                <td class="col-status">
                    <span class="status-badge" style="background: {{ cat.statusColour }}20; color: {{ cat.statusColour }};">{{ cat.status }}</span>
                </td>
                <td class="col-rules">{{ cat.ruleCount }}</td>
                <td class="col-detail">{{ cat.detail | default("—") }}</td>
            </tr>
            {% endfor %}
        </tbody>
    </table>
    {% else %}
    <div class="empty-state">No category data available.</div>
    {% endif %}
</div>

<!-- ================================================================== -->
<!-- SECTION 5: FLEXIBILITY ANALYSIS                                    -->
<!-- ================================================================== -->
<div class="section">
    <h2>Flexibility Analysis</h2>
    <p class="section-subtitle">Whether negotiated positions fall within your playbook's acceptable ranges.</p>

    {% if flexibility and flexibility | length > 0 %}
    <table class="compliance-table">
        <thead>
            <tr>
                <th class="col-clause">Clause</th>
                <th class="col-category">Category</th>
                <th class="col-position">Current</th>
                <th class="col-range">Playbook Range</th>
                <th class="col-status">Status</th>
            </tr>
        </thead>
        <tbody>
            {% for flex in flexibility %}
            <tr>
                <td class="col-clause">{{ flex.clause }}</td>
                <td class="col-category">{{ flex.category }}</td>
                <td class="col-position">{{ flex.currentPosition }}</td>
                <td class="col-range">{{ flex.playbookMin }} — {{ flex.playbookMax }}</td>
                <td class="col-status">
                    <span class="status-badge" style="background: {{ flex.statusColour }}20; color: {{ flex.statusColour }};">{{ flex.statusLabel }}</span>
                </td>
            </tr>
            {% endfor %}
        </tbody>
    </table>
    {% else %}
    <div class="empty-state">No flexibility data available.</div>
    {% endif %}
</div>

<!-- ================================================================== -->
<!-- SECTION 6: DISCLAIMER                                              -->
<!-- ================================================================== -->
<div class="disclaimer-block">
    <div class="disclaimer-icon">&#128274;</div>
    <div class="disclaimer-text">
        <strong>Initiator Eyes Only</strong><br>
        This Playbook Compliance Report has been generated by CLARENCE and compares the current negotiated positions
        against your organisation's active playbook &ldquo;{{ playbookName | default("Playbook") }}&rdquo;.
        The counterparty does not have access to this report, your playbook, or any compliance scores.
        Compliance assessments are based on rule definitions at time of generation and may change if playbook rules are updated.
    </div>
</div>
