/** Multi-step Power Fx / WDL learning quests. All data is synthetic. */
export const lessons = [
  {
    id:'queue-triage', level:'Foundation',platform:'canvas',category:'Service operations',estimatedMinutes:8,
    title:'Prioritize a service queue',subtitle:'Build a backlog that an on-call team can actually use.',
    goal:'Identify unresolved high-severity tickets, then order by waiting time.',
    skills:['Filter','SortByColumns','Chained outputs'],
    inputs:{Tickets:[{Id:'T-1',Status:'Open',Severity:'High',AgeHours:20},{Id:'T-2',Status:'Closed',Severity:'High',AgeHours:30},{Id:'T-3',Status:'Open',Severity:'Low',AgeHours:8},{Id:'T-4',Status:'Open',Severity:'High',AgeHours:43}]},
    variants:[{name:'Second queue',inputs:{Tickets:[{Id:'B-1',Status:'Open',Severity:'High',AgeHours:5},{Id:'B-2',Status:'Open',Severity:'High',AgeHours:33},{Id:'B-3',Status:'Closed',Severity:'Low',AgeHours:90}]}}],
    steps:[
      {title:'Find unresolved tickets',instruction:'Return all records whose Status equals Open.',hint:'Filter(Table, Status="Open")',solution:'Filter(Tickets, Status="Open")',why:'Filter evaluates its predicate for each record. The result is a table, even if only one record matches.'},
      {title:'Escalate the severe',instruction:'Filter the result of Step1 to only High-severity incidents.',hint:'Use Step1 as your table, rather than filtering Tickets again.',solution:'Filter(Step1, Severity="High")',why:'Each completed step exposes its output as Step1, Step2, and so on.'},
      {title:'Order the response',instruction:'Sort Step2 by AgeHours descending (oldest first).',hint:'SortByColumns(...,"AgeHours",SortOrder.Descending)',solution:'SortByColumns(Step2,"AgeHours",SortOrder.Descending)',why:'Stable sorting preserves original order for equal values.'}
    ]
  },
  {
    id:'inventory-shortfall',level:'Intermediate',platform:'canvas',category:'Supply chain',estimatedMinutes:10,
    title:'Build a replenishment shortlist',subtitle:'Calculate shortages across changing warehouses.',
    goal:'Filter understocked SKUs, calculate the shortage and prioritize orders.',skills:['Filter','AddColumns','SortByColumns'],
    inputs:{Inventory:[{SKU:'A',OnHand:3,ReorderPoint:12},{SKU:'B',OnHand:40,ReorderPoint:25},{SKU:'C',OnHand:7,ReorderPoint:8}]},
    variants:[{name:'Second warehouse',inputs:{Inventory:[{SKU:'D',OnHand:2,ReorderPoint:3},{SKU:'E',OnHand:5,ReorderPoint:20},{SKU:'F',OnHand:12,ReorderPoint:9}]}}],
    steps:[
      {title:'Find low inventory',instruction:'Keep products with OnHand below ReorderPoint.',hint:'Compare two row fields directly in Filter.',solution:'Filter(Inventory, OnHand < ReorderPoint)',why:'Comparisons in record scope can use field names directly.'},
      {title:'Calculate units missing',instruction:'Add a Gap column to Step1 equal to ReorderPoint minus OnHand.',hint:'AddColumns(Step1, Gap, ...)',solution:'AddColumns(Step1,Gap,ReorderPoint-OnHand)',why:'AddColumns computes a value for every retained row.'},
      {title:'Prioritize buyers',instruction:'Sort Step2 by Gap descending.',hint:'SortByColumns with SortOrder.Descending.',solution:'SortByColumns(Step2,"Gap",SortOrder.Descending)',why:'A larger gap gets attention first.'}
    ]
  },
  {
    id:'lead-handoff',level:'Intermediate',platform:'canvas',category:'CRM & marketing',estimatedMinutes:12,
    title:'Segment sales-ready leads',subtitle:'Translate qualification rules into repeatable logic.',
    goal:'Keep qualified Peruvian leads above a score threshold and label priority.',skills:['Filter','Multiple predicates','AddColumns','ShowColumns'],
    inputs:{Leads:[{Company:'Alpha',Status:'Qualified',Country:'PE',Score:92},{Company:'Beta',Status:'New',Country:'PE',Score:95},{Company:'Gamma',Status:'Qualified',Country:'CL',Score:80},{Company:'Delta',Status:'Qualified',Country:'PE',Score:78}]},
    variants:[{name:'New campaign',inputs:{Leads:[{Company:'Echo',Status:'Qualified',Country:'PE',Score:70},{Company:'Foxtrot',Status:'Qualified',Country:'PE',Score:99},{Company:'Golf',Status:'Qualified',Country:'PE',Score:86}]}}],
    steps:[
      {title:'Keep qualified leads',instruction:'Filter Leads to Status = Qualified.',hint:'Filter(Leads, Status="Qualified")',solution:'Filter(Leads,Status="Qualified")',why:'The initial stage isolates eligible records.'},
      {title:'Apply geography + scoring',instruction:'From Step1 keep Country PE and Score at least 75.',hint:'Filter can take multiple predicates separated by commas.',solution:'Filter(Step1,Country="PE",Score>=75)',why:'Multiple Filter predicates are combined with AND.'},
      {title:'Add purchase priority',instruction:'Add Priority: Hot if Score >= 90, else Warm.',hint:'AddColumns(..., Priority, If(...))',solution:'AddColumns(Step2,Priority,If(Score>=90,"Hot","Warm"))',why:'If can be nested inside a table-shaping function.'},
      {title:'Create a CRM-ready payload',instruction:'Return Company, Priority and Score from Step3.',hint:'ShowColumns(Step3,Company,Priority,Score)',solution:'ShowColumns(Step3,Company,Priority,Score)',why:'Projecting columns reduces unnecessary fields in downstream automation.'}
    ]
  },
  {
    id:'security-review',level:'Advanced',platform:'canvas',category:'Security & governance',estimatedMinutes:13,
    title:'Detect risky privileged accounts',subtitle:'Intersect access rights, account state and failure signals.',
    goal:'Identify active privileged users with repeated sign-in failures.',skills:['Filter','OR/AND logic','IsBlank','AddColumns'],
    inputs:{Users:[{Name:'Ari',Enabled:true,Role:'Admin',FailedLogins:5,LastLogin:'2026-10-25'},{Name:'Ben',Enabled:true,Role:'Reader',FailedLogins:8,LastLogin:'2026-10-26'},{Name:'Cora',Enabled:false,Role:'Owner',FailedLogins:7,LastLogin:'2026-10-21'},{Name:'Dina',Enabled:true,Role:'Owner',FailedLogins:4,LastLogin:'2026-11-01'}]},
    variants:[{name:'New audit cohort',inputs:{Users:[{Name:'Eli',Enabled:true,Role:'Owner',FailedLogins:2,LastLogin:'2026-10-20'},{Name:'Fin',Enabled:true,Role:'Admin',FailedLogins:6,LastLogin:null},{Name:'Gina',Enabled:true,Role:'Admin',FailedLogins:7,LastLogin:'2026-10-30'}]}}],
    steps:[
      {title:'Check enabled accounts',instruction:'Select Enabled = true users.',hint:'Filter(Users,Enabled=true)',solution:'Filter(Users,Enabled=true)',why:'Only active identities are relevant to this audit.'},
      {title:'Limit to privileged roles',instruction:'Keep users whose Role is Admin OR Owner.',hint:'Use parentheses or ||.',solution:'Filter(Step1,Role="Admin" || Role="Owner")',why:'OR joins alternatives inside an otherwise restrictive AND pipeline.'},
      {title:'Require evidence of risk',instruction:'Require FailedLogins >= 3 and a nonblank LastLogin.',hint:'!IsBlank(LastLogin) means a login is present.',solution:'Filter(Step2,FailedLogins>=3 && !IsBlank(LastLogin))',why:'Blank handling matters for accounts without complete activity history.'},
      {title:'Add an audit risk metric',instruction:'Add RiskPoints = FailedLogins * 10.',hint:'AddColumns(Step3,RiskPoints,FailedLogins*10)',solution:'AddColumns(Step3,RiskPoints,FailedLogins*10)',why:'Materialize a score for downstream dashboards.'}
    ]
  },
  {
    id:'invoice-correlation',level:'Expert',platform:'canvas',category:'Finance & reconciliation',estimatedMinutes:20,
    title:'Recover overdue customer exposure',subtitle:'Correlate two tables using nested scopes and aliases.',
    goal:'Find customers with overdue invoices and rank those owing 500 or more.',skills:['As alias','CountIf','Filter','Sum','AddColumns','SortByColumns'],
    inputs:{Customers:[{Id:1,Name:'Northwind'},{Id:2,Name:'Contoso'},{Id:3,Name:'Fabrikam'}],Invoices:[{CustomerId:1,Status:'Overdue',Amount:400},{CustomerId:1,Status:'Overdue',Amount:250},{CustomerId:2,Status:'Paid',Amount:1000},{CustomerId:3,Status:'Overdue',Amount:120}]},
    variants:[{name:'Second ledger',inputs:{Customers:[{Id:7,Name:'Atlas'},{Id:8,Name:'Bravo'}],Invoices:[{CustomerId:7,Status:'Overdue',Amount:250},{CustomerId:7,Status:'Paid',Amount:900},{CustomerId:8,Status:'Overdue',Amount:610}]}}],
    steps:[
      {title:'Correlate open debts',instruction:'Filter Customers as c, keeping customers with at least one Invoice as i where CustomerId matches c.Id and Status is Overdue.',hint:'Filter(Customers As c, CountIf(Invoices As i, i.CustomerId=c.Id && i.Status="Overdue")>0)',solution:'Filter(Customers As c,CountIf(Invoices As i,i.CustomerId=c.Id && i.Status="Overdue")>0)',why:'Explicit As aliases avoid ambiguous fields in nested record scopes.'},
      {title:'Compute exposure per customer',instruction:'Add OverdueTotal to Step1 using Sum(Filter(Invoices ...),Amount) for each customer.',hint:'AddColumns(Step1 As c,OverdueTotal,Sum(Filter(Invoices As i,i.CustomerId=c.Id && i.Status="Overdue"),Amount))',solution:'AddColumns(Step1 As c,OverdueTotal,Sum(Filter(Invoices As i,i.CustomerId=c.Id && i.Status="Overdue"),Amount))',why:'The outer c alias remains available inside the nested invoice filter.'},
      {title:'Apply collection threshold',instruction:'Keep only Step2 records with OverdueTotal >= 500.',hint:'Filter(Step2,OverdueTotal>=500)',solution:'Filter(Step2,OverdueTotal>=500)',why:'Apply business thresholds to derived values only after calculation.'},
      {title:'Rank outstanding balances',instruction:'Sort Step3 by OverdueTotal, largest first.',hint:'SortByColumns(Step3,"OverdueTotal",SortOrder.Descending)',solution:'SortByColumns(Step3,"OverdueTotal",SortOrder.Descending)',why:'The result can be fed to a collections work queue.'}
    ]
  },
  {
    id:'pipeline-forecast',level:'Advanced',platform:'canvas',category:'Revenue operations',estimatedMinutes:14,
    title:'Calculate weighted forecast',subtitle:'Combine probabilistic deals, filtering and scoped business targets.',
    goal:'Identify relevant opportunities and compare weighted pipeline with target.',skills:['AddColumns','Filter','Sum','With','If'],
    inputs:{Deals:[{Id:'D-1',Amount:20000,Probability:60,Stage:'Proposal'},{Id:'D-2',Amount:30000,Probability:20,Stage:'Lost'},{Id:'D-3',Amount:10000,Probability:80,Stage:'Negotiation'}],Target:15000},
    variants:[{name:'Stretch target',inputs:{Deals:[{Id:'X-1',Amount:5000,Probability:60,Stage:'Proposal'},{Id:'X-2',Amount:18000,Probability:70,Stage:'Negotiation'}],Target:14000}}],
    steps:[
      {title:'Weight each deal',instruction:'Add Weighted equal to Amount * Probability / 100.',hint:'AddColumns(Deals,Weighted,Amount*Probability/100)',solution:'AddColumns(Deals,Weighted,Amount*Probability/100)',why:'Probability is expressed as a percentage rather than a fraction.'},
      {title:'Choose forecastable deals',instruction:'Keep deals not Lost and Weighted >= 5000.',hint:'Use Stage<>"Lost" and Weighted>=5000.',solution:'Filter(Step1,Stage<>"Lost" && Weighted>=5000)',why:'Avoid counting deals that cannot contribute to the forecast.'},
      {title:'Aggregate weighted value',instruction:'Sum the Weighted values in Step2.',hint:'Sum(Step2,Weighted)',solution:'Sum(Step2,Weighted)',why:'Sum can aggregate a calculated column.'},
      {title:'Compare with quarterly target',instruction:'Use With to create Forecast=Step3 and Goal=Target, return "On target" or "Below target".',hint:'With({Forecast:Step3,Goal:Target},If(Forecast>=Goal,"On target","Below target"))',solution:'With({Forecast:Step3,Goal:Target},If(Forecast>=Goal,"On target","Below target"))',why:'With makes a complex final decision easier to audit.'}
    ]
  },
  {
    id:'regional-reporting',level:'Expert',platform:'canvas',category:'Analytics & reporting',estimatedMinutes:18,
    title:'Build a regional sales leaderboard',subtitle:'Turn transactional records into a sortable management report.',
    goal:'Aggregate only paid orders by region and display their ranking.',skills:['GroupBy','Ungroup concepts','AddColumns','Sum','DropColumns','SortByColumns'],
    inputs:{Orders:[{Id:1,Region:'North',Status:'Paid',Total:300},{Id:2,Region:'South',Status:'Open',Total:800},{Id:3,Region:'South',Status:'Paid',Total:600},{Id:4,Region:'North',Status:'Paid',Total:250}]},
    variants:[{name:'New quarter',inputs:{Orders:[{Id:5,Region:'West',Status:'Paid',Total:700},{Id:6,Region:'East',Status:'Paid',Total:150},{Id:7,Region:'East',Status:'Paid',Total:600},{Id:8,Region:'West',Status:'Open',Total:200}]}}],
    steps:[
      {title:'Exclude open orders',instruction:'Keep Status = Paid records only.',hint:'Filter(Orders,Status="Paid")',solution:'Filter(Orders,Status="Paid")',why:'An unresolved order must not inflate paid revenue.'},
      {title:'Group transactions',instruction:'Group Step1 by Region into the nested Rows column.',hint:'GroupBy(Step1,Region,Rows)',solution:'GroupBy(Step1,Region,Rows)',why:'GroupBy returns one record per region containing a nested table.'},
      {title:'Calculate revenue',instruction:'Add Revenue equal to Sum(Rows,Total).',hint:'AddColumns(Step2,Revenue,Sum(Rows,Total))',solution:'AddColumns(Step2,Revenue,Sum(Rows,Total))',why:'Each grouped record exposes its nested table in Rows.'},
      {title:'Flatten the board',instruction:'Drop Rows and order by Revenue descending.',hint:'SortByColumns(DropColumns(Step3,Rows),"Revenue",SortOrder.Descending)',solution:'SortByColumns(DropColumns(Step3,Rows),"Revenue",SortOrder.Descending)',why:'The final output contains a concise region and revenue leaderboard.'}
    ]
  },
  {
    id:'data-quality-regex',level:'Advanced',platform:'canvas',category:'Data quality',estimatedMinutes:15,
    title:'Validate imported contact records',subtitle:'Repair a CRM import by filtering on regex and composing a clean payload.',
    goal:'Identify valid contact emails and customer codes without remote connectors.',skills:['IsMatch','Regex','AddColumns','Filter','ShowColumns'],
    inputs:{Contacts:[{Email:'ana@example.com',Code:'PE-120',Name:'Ana'},{Email:'bad-address',Code:'PE-540',Name:'Ben'},{Email:'luis@example.org',Code:'NOT-123',Name:'Luis'},{Email:'zoe@company.net',Code:'US-900',Name:'Zoe'}]},
    variants:[{name:'Second import',inputs:{Contacts:[{Email:'one@valid.io',Code:'US-999',Name:'One'},{Email:'invalid',Code:'US-111',Name:'Two'},{Email:'three@valid.io',Code:'MX-101',Name:'Three'}]}}],
    steps:[
      {title:'Validate email syntax',instruction:'Filter Contacts with emails matching a simple pattern: ^[^@ ]+@[^@ ]+\\.[A-Za-z]+$ (a simplified example, not production email validation).',hint:'IsMatch(Email,"^[^@ ]+@[^@ ]+\\.[A-Za-z]+$")',solution:'Filter(Contacts,IsMatch(Email,"^[^@ ]+@[^@ ]+\\.[A-Za-z]+$"))',why:'Client regex validation can flag obvious issues, but it does not prove deliverability.'},
      {title:'Check customer codes',instruction:'Add CodeValid based on a regex for two uppercase letters, dash, three digits.',hint:'IsMatch(Code,"^[A-Z]{2}-[0-9]{3}$")',solution:'AddColumns(Step1,CodeValid,IsMatch(Code,"^[A-Z]{2}-[0-9]{3}$"))',why:'Constant regex patterns keep the test predictable.'},
      {title:'Reject malformed codes',instruction:'Keep records with CodeValid=true.',hint:'Filter(Step2,CodeValid=true)',solution:'Filter(Step2,CodeValid=true)',why:'Use the calculated boolean as a filtering predicate.'},
      {title:'Produce an export payload',instruction:'Select only Email, Code, and Name columns.',hint:'ShowColumns(Step3,Email,Code,Name)',solution:'ShowColumns(Step3,Email,Code,Name)',why:'Share only the validated attributes needed downstream.'}
    ]
  },
  {
    id:'correlated-orders',level:'Boss',platform:'canvas',category:'Multi-table logic',estimatedMinutes:25,
    title:'Correlated revenue exceptions',subtitle:'The hardest record-scope puzzle: join, aggregate, filter and project.',
    goal:'Identify Gold customers with qualifying open orders and high total open value.',skills:['Nested Filter','As aliases','CountIf','Sum','AddColumns','ShowColumns'],
    inputs:{Customers:[{Id:1,Name:'Apex',Tier:'Gold'},{Id:2,Name:'Beacon',Tier:'Silver'},{Id:3,Name:'Cedar',Tier:'Gold'}],Orders:[{CustomerId:1,Status:'Open',Total:400},{CustomerId:1,Status:'Open',Total:350},{CustomerId:2,Status:'Open',Total:900},{CustomerId:3,Status:'Paid',Total:1200}],Threshold:300},
    variants:[{name:'New customers',inputs:{Customers:[{Id:4,Name:'Delta',Tier:'Gold'},{Id:5,Name:'Echo',Tier:'Gold'}],Orders:[{CustomerId:4,Status:'Open',Total:325},{CustomerId:4,Status:'Open',Total:300},{CustomerId:5,Status:'Open',Total:100}],Threshold:200}}],
    steps:[
      {title:'Correlate qualifying orders',instruction:'Keep Customers as c when CountIf(Orders as o) finds an Open order with o.Total>=Threshold linked to c.Id.',hint:'Filter(Customers As c,CountIf(Orders As o,o.CustomerId=c.Id && o.Status="Open" && o.Total>=Threshold)>0)',solution:'Filter(Customers As c,CountIf(Orders As o,o.CustomerId=c.Id && o.Status="Open" && o.Total>=Threshold)>0)',why:'An inner row scope must reference the outer customer through c.Id.'},
      {title:'Sum all open exposure',instruction:'Add OpenValue to Step1, summing all Open orders matching the current customer.',hint:'AddColumns(Step1 As c,OpenValue,Sum(Filter(Orders As o,o.CustomerId=c.Id && o.Status="Open"),Total))',solution:'AddColumns(Step1 As c,OpenValue,Sum(Filter(Orders As o,o.CustomerId=c.Id && o.Status="Open"),Total))',why:'The qualifying-order threshold is not applied to this total: all open amounts count.'},
      {title:'Enforce premium exception policy',instruction:'Keep Gold customers with OpenValue>=600.',hint:'Filter(Step2,Tier="Gold" && OpenValue>=600)',solution:'Filter(Step2,Tier="Gold" && OpenValue>=600)',why:'Both segmentation and computed aggregate thresholds must pass.'},
      {title:'Expose minimal escalation view',instruction:'Return Name and OpenValue only.',hint:'ShowColumns(Step3,Name,OpenValue)',solution:'ShowColumns(Step3,Name,OpenValue)',why:'This is the smallest useful payload for the escalation handoff.'}
    ]
  },
  {
    id:'trace-decisions',level:'Advanced',platform:'canvas',category:'Observability',estimatedMinutes:12,
    title:'Explain a risk decision with Trace',subtitle:'Inspect simulated behavior diagnostics alongside a business result.',
    goal:'Calculate an escalation decision and issue one diagnostic trace event.',skills:['With','If','Trace','Behavior-only semantics'],
    inputs:{Score:25,Factor:3},variants:[{name:'Lower-risk user',inputs:{Score:8,Factor:2}}],
    steps:[
      {title:'Build a scoped risk calculation',instruction:'Return Risk = Score * Factor using With.',hint:'With({Risk:Score*Factor},Risk)',solution:'With({Risk:Score*Factor},Risk)',why:'A scoped calculation avoids recomputing the same subexpression.'},
      {title:'Classify the decision',instruction:'Return "Escalate" if Step1>=50; otherwise "Monitor".',hint:'If(Step1>=50,"Escalate","Monitor")',solution:'If(Step1>=50,"Escalate","Monitor")',why:'The decision is deterministic for the current synthetic context.'},
      {title:'Emit a diagnostic event',instruction:'Trace "Decision" with severity Warning and custom record Decision:Step2, Score:Score.',hint:'Trace("Decision",TraceSeverity.Warning,{Decision:Step2,Score:Score})',solution:'Trace("Decision",TraceSeverity.Warning,{Decision:Step2,Score:Score})',why:'This sandbox captures simulated Trace events, not actual Live Monitor or App Insights telemetry.'}
    ]
  },
  {
    id:'flow-approval',level:'Intermediate',platform:'flow',category:'Power Automate',estimatedMinutes:10,
    title:'Route an expense approval',subtitle:'Evaluate nested workflow outputs without launching a real cloud flow.',
    goal:'Check a limit, produce a routing result, and format an audit message.',skills:['outputs()','variables()','greater()','if()','concat()'],
    inputs:{'outputs:Expense':{amount:2700,id:'EXP-101'},'variables:limit':2000},
    variants:[{name:'Under-limit request',inputs:{'outputs:Expense':{amount:1500,id:'EXP-202'},'variables:limit':2000}}],
    steps:[
      {title:'Check approval threshold',instruction:'Return true if outputs("Expense").amount is greater than variables("limit").',hint:"greater(outputs('Expense')?['amount'],variables('limit'))",solution:"greater(outputs('Expense')?['amount'],variables('limit'))",why:'WDL is a different expression language from Canvas Power Fx.'},
      {title:'Choose the route',instruction:'Return Approval required when Step1 is true; otherwise Auto approved.',hint:"if(outputs('Step1'),'Approval required','Auto approved')",solution:"if(outputs('Step1'),'Approval required','Auto approved')",why:'In this lab outputs(\'Step1\') simulates a Compose action named Step1 from a real cloud flow.'},
      {title:'Record a flow message',instruction:'Concatenate Expense ID, colon and Step2.',hint:"concat(outputs('Expense')?['id'],': ',outputs('Step2'))",solution:"concat(outputs('Expense')?['id'],': ',outputs('Step2'))",why:'Concat produces deterministic text without invoking a connector.'}
    ]
  },
  {
    id:'flow-idempotency',level:'Advanced',platform:'flow',category:'Power Automate',estimatedMinutes:12,
    title:'Protect a webhook from duplicates',subtitle:'Gate workflow execution using a status and a durable event identifier.',
    goal:'Evaluate whether an inbound event is complete and has an ID.',skills:['triggerBody()','equals()','empty()','and()','not()','if()'],
    inputs:{triggerbody:{status:'complete',eventId:'evt-42'}},
    variants:[{name:'Incomplete event',inputs:{triggerbody:{status:'pending',eventId:''}}}],
    steps:[
      {title:'Check completed status',instruction:'Check if triggerBody().status equals complete.',hint:"equals(triggerBody()?['status'],'complete')",solution:"equals(triggerBody()?['status'],'complete')",why:'Use null-safe property access when inputs can be incomplete.'},
      {title:'Verify the event ID',instruction:'Return true only when Step1 is true and triggerBody().eventId is not empty.',hint:"and(outputs('Step1'),not(empty(triggerBody()?['eventId'])))",solution:"and(outputs('Step1'),not(empty(triggerBody()?['eventId'])))",why:'This is only a precondition: true idempotency also needs persistent deduplication.'},
      {title:'Choose the action',instruction:'Return Process when Step2 is true; otherwise Ignore.',hint:"if(outputs('Step2'),'Process','Ignore')",solution:"if(outputs('Step2'),'Process','Ignore')",why:'No workflow actions are actually executed in the playground.'}
    ]
  }
];
