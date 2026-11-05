
/** Human-reviewed Spanish task descriptions for the built-in curriculum.
 * Formula code is language-neutral; explanatory texts fall back to English when absent.
 */
const ES={
 'queue-triage':{
  title:'Prioriza una cola de soporte',subtitle:'Construye una cola útil para el equipo de guardia.',goal:'Identifica tickets abiertos graves y ordénalos por antigüedad.',
  steps:[
   ['Encuentra los tickets abiertos','Devuelve todos los registros cuyo campo Status sea Open.','Filter evalúa la condición por cada fila y devuelve una tabla.'],
   ['Escala los casos graves','Filtra Step1 para conservar únicamente incidentes de severidad High.','La salida del paso anterior está disponible como Step1.'],
   ['Ordena la respuesta','Ordena Step2 por AgeHours descendente; primero el más antiguo.','SortByColumns organiza los datos por una columna concreta.']
  ]
 },
 'inventory-shortfall':{
  title:'Prepara una lista de reposición',subtitle:'Detecta escasez real y ordena las compras.',goal:'Selecciona productos bajo el punto de reposición y calcula las unidades faltantes.',
  steps:[
   ['Detecta inventario bajo','Conserva los productos con OnHand menor que ReorderPoint.','Puedes comparar dos columnas dentro de Filter.'],
   ['Calcula las unidades faltantes','Agrega a Step1 una columna Gap igual a ReorderPoint menos OnHand.','AddColumns crea valores por registro sin cambiar la fuente original.'],
   ['Prioriza las compras','Ordena Step2 por Gap descendente.','Una brecha más grande debe aparecer primero.']
  ]
 },
 'lead-handoff':{
  title:'Segmenta leads listos para ventas',subtitle:'Prepara un handoff limpio hacia el CRM.',goal:'Aplica calidad, país y scoring antes de derivar un lead comercial.',
  steps:[
   ['Filtra leads calificados','Filtra Leads para Status igual a Qualified.','Empieza por identificar registros elegibles.'],
   ['Aplica país y scoring','De Step1 conserva Country PE y Score mayor o igual que 75.','Filter permite varias condiciones combinadas con AND.'],
   ['Agrega prioridad comercial','Crea Priority: Hot cuando Score sea al menos 90; de lo contrario Warm.','Puedes usar If dentro de AddColumns.'],
   ['Crea el payload para CRM','Devuelve solamente Company, Priority y Score desde Step3.','ShowColumns reduce datos innecesarios en una automatización.']
  ]
 },
 'security-review':{
  title:'Detecta cuentas privilegiadas de riesgo',subtitle:'Audita accesos con controles de evidencia.',goal:'Encuentra identidades activas privilegiadas y calcula su riesgo.',
  steps:[
   ['Comprueba cuentas activas','Selecciona usuarios con Enabled = true.','Solo las identidades activas son relevantes para este control.'],
   ['Limita a roles privilegiados','Conserva usuarios con Role Admin u Owner.','Utiliza || o un Or explícito para alternativas.'],
   ['Exige evidencia de riesgo','Pide FailedLogins de al menos 3 y LastLogin no vacío.','Los valores Blank necesitan tratamiento explícito.'],
   ['Agrega una métrica de auditoría','Crea RiskPoints = FailedLogins * 10.','Una columna calculada permite priorizar revisiones.']
  ]
 },
 'invoice-correlation':{
  title:'Recupera exposición de deuda vencida',subtitle:'Relaciona clientes y facturas mediante filtros anidados.',goal:'Identifica clientes con facturas vencidas y calcula el saldo por cobrar.',
  steps:[
   ['Relaciona deudas pendientes','Filtra Customers As c: conserva clientes con al menos una Invoice As i del mismo CustomerId, en estado Overdue.','Usa alias As para distinguir ámbitos anidados.'],
   ['Calcula deuda por cliente','Añade OverdueTotal a Step1 sumando importes Overdue de cada cliente.','El alias exterior c sigue disponible en Filter interno.'],
   ['Aplica umbral de cobranza','Conserva Step2 con OverdueTotal mayor o igual que 500.','Aplica umbrales después de calcular las columnas derivadas.'],
   ['Ordena saldos pendientes','Ordena Step3 por OverdueTotal de mayor a menor.','Produce una cola de trabajo para cobranza.']
  ]
 },
 'pipeline-forecast':{
  title:'Calcula un forecast ponderado',subtitle:'Crea un pronóstico con probabilidad y meta.',goal:'Pondera oportunidades y compara el pronóstico con el objetivo.',
  steps:[
   ['Pondera cada oportunidad','Añade Weighted = Amount * Probability / 100.','Probability se expresa como porcentaje.'],
   ['Selecciona oportunidades válidas','Conserva oportunidades cuyo Stage no sea Lost y Weighted sea al menos 5000.','Evita incluir oportunidades perdidas en el forecast.'],
   ['Suma el valor ponderado','Suma Weighted de Step2.','Sum agrega una columna calculada.'],
   ['Compara con el objetivo trimestral','Usa With para Forecast=Step3 y Goal=Target; devuelve On target o Below target.','With facilita leer y auditar cálculos complejos.']
  ]
 },
 'regional-reporting':{
  title:'Construye un ranking regional de ventas',subtitle:'Combina agrupaciones, totales y ordenación.',goal:'Resume el ingreso pagado por región y construye un ranking.',
  steps:[
   ['Excluye pedidos abiertos','Conserva solo registros con Status igual a Paid.','No sumes ingresos todavía no pagados.'],
   ['Agrupa transacciones','Agrupa Step1 por Region en una tabla anidada llamada Rows.','GroupBy crea una tabla por cada región.'],
   ['Calcula el ingreso','Añade Revenue con la suma de Rows.Total.','Rows es la tabla hija de cada grupo.'],
   ['Simplifica el reporte','Elimina Rows y ordena Revenue descendente.','La salida final solo necesita región e ingreso.']
  ]
 },
 'data-quality-regex':{
  title:'Valida contactos importados con regex',subtitle:'Identifica errores de formato antes de una importación.',goal:'Comprueba correos y códigos y exporta solo los registros válidos.',
  steps:[
   ['Valida el correo','Filtra Contacts con un correo que coincida con ^[^@ ]+@[^@ ]+\\.[A-Za-z]+$. Es una validación simplificada.','Un patrón regex no garantiza que el correo exista.'],
   ['Comprueba códigos','Agrega CodeValid usando un patrón de dos mayúsculas, guion y tres dígitos.','Usa un patrón constante para obtener resultados reproducibles.'],
   ['Descarta códigos mal formados','Conserva registros donde CodeValid sea true.','Filtra por la columna calculada.'],
   ['Prepara el payload de exportación','Selecciona solo Email, Code y Name.','Exporta únicamente atributos validados.']
  ]
 },
 'correlated-orders':{
  title:'Excepciones de ingresos correlacionados',subtitle:'Un desafío de filtros anidados y ámbitos de registro.',goal:'Busca clientes premium con pedidos abiertos de riesgo.',
  steps:[
   ['Relaciona pedidos elegibles','Conserva Customers As c cuando CountIf(Orders As o) encuentre un pedido Open asociado y o.Total >= Threshold.','Referénciate al cliente exterior con c.Id.'],
   ['Suma exposición abierta','Añade OpenValue a Step1 sumando todos los pedidos Open del cliente.','La suma incluye todos los pedidos abiertos, no solo los que superan Threshold.'],
   ['Aplica política premium','Conserva clientes Gold con OpenValue >= 600.','Deben cumplirse segmentación y monto.'],
   ['Devuelve vista de escalamiento','Devuelve únicamente Name y OpenValue.','Usa el payload mínimo útil para la derivación.']
  ]
 },
 'trace-decisions':{
  title:'Explica una decisión con Trace',subtitle:'Inspecciona eventos de diagnóstico simulados.',goal:'Calcula un riesgo, clasifica el resultado y emite una traza.',
  steps:[
   ['Calcula el riesgo en With','Devuelve Risk = Score * Factor usando With.','With evita repetir el mismo cálculo.'],
   ['Clasifica la decisión','Devuelve Escalate si Step1 >= 50, de lo contrario Monitor.','Una decisión reproducible se puede comprobar con distintos datasets.'],
   ['Emite un evento de diagnóstico','Registra Trace Decision con severidad Warning y campos Decision:Step2 y Score:Score.','El portal simula eventos Trace; no envía telemetría real.']
  ]
 },
 'flow-approval':{
  title:'Enruta una aprobación de gastos',subtitle:'Aplica condiciones en expresiones WDL de Power Automate.',goal:'Decide si un gasto necesita aprobación y crea su mensaje.',
  steps:[
   ['Comprueba el umbral','Devuelve true si outputs("Expense").amount supera variables("limit").','WDL y Canvas Power Fx son lenguajes distintos.'],
   ['Elige la ruta','Devuelve Approval required si Step1 es true; de lo contrario Auto approved.','outputs("Step1") representa una acción Compose simulada.'],
   ['Registra un mensaje','Concatena Expense ID, dos puntos y Step2.','Concat no invoca conectores.']
  ]
 },
 'flow-idempotency':{
  title:'Protege un webhook de duplicados',subtitle:'Valida entradas antes de procesar mensajes.',goal:'Comprueba el evento y decide si procesarlo o ignorarlo.',
  steps:[
   ['Comprueba el estado final','Valida que triggerBody().status sea complete.','Usa acceso seguro a propiedades que pueden faltar.'],
   ['Verifica el identificador','Devuelve true solo si Step1 es true y eventId no está vacío.','La idempotencia real requiere persistir identificadores procesados.'],
   ['Elige la acción','Devuelve Process cuando Step2 sea true; si no, Ignore.','No se ejecutan acciones de Power Automate desde el portal.']
  ]
 }
};
const ES_HINTS={
'queue-triage':['Filter(Tickets, Status="Open")','Usa Step1 como tabla en vez de volver a filtrar Tickets.','Ordena por "AgeHours" con SortOrder.Descending.'],
'inventory-shortfall':['Compara directamente dos campos de la fila en Filter.','AddColumns(Step1, Gap, ...)','Usa SortByColumns y SortOrder.Descending.'],
'lead-handoff':['Filter(Leads, Status="Qualified")','Filter admite varias condiciones separadas por comas.','AddColumns(..., Priority, If(...))','ShowColumns(Step3, Company, Priority, Score)'],
'security-review':['Filter(Users, Enabled=true)','Agrupa condiciones con paréntesis o ||.','!IsBlank(LastLogin) comprueba si existe un valor.','AddColumns(Step3, RiskPoints, FailedLogins*10)'],
'invoice-correlation':['Filter(Customers As c, CountIf(Invoices As i, i.CustomerId=c.Id && i.Status="Overdue")>0)','El alias c de AddColumns permanece disponible en Filter interno.','Filter(Step2, OverdueTotal>=500)','SortByColumns(Step3,"OverdueTotal",SortOrder.Descending)'],
'pipeline-forecast':['AddColumns(Deals, Weighted, Amount*Probability/100)','Usa Stage<>"Lost" y Weighted>=5000.','Sum(Step2, Weighted)','Usa With({Forecast:Step3,Goal:Target}, If(...)).'],
'regional-reporting':['Filter(Orders, Status="Paid")','GroupBy(Step1, Region, Rows)','AddColumns(Step2, Revenue, Sum(Rows,Total))','Combina DropColumns y SortByColumns en Step3.'],
'data-quality-regex':['IsMatch(Email, "^[^@ ]+@[^@ ]+\\.[A-Za-z]+$")','IsMatch(Code, "^[A-Z]{2}-[0-9]{3}$")','Filter(Step2, CodeValid=true)','ShowColumns(Step3, Email, Code, Name)'],
'correlated-orders':['Usa CountIf(Orders As o, o.CustomerId=c.Id) dentro de Filter(Customers As c, ...).','Usa el alias c exterior en el filtro de pedidos.','Filter(Step2, Tier="Gold" && OpenValue>=600)','ShowColumns(Step3, Name, OpenValue)'],
'trace-decisions':['With({Risk:Score*Factor}, Risk)','If(Step1>=50,"Escalate","Monitor")','Trace("Decision", TraceSeverity.Warning, {Decision:Step2,Score:Score})'],
'flow-approval':["greater(outputs('Expense')?['amount'],variables('limit'))","if(outputs('Step1'),'Approval required','Auto approved')","concat(outputs('Expense')?['id'],': ',outputs('Step2'))"],
'flow-idempotency':["equals(triggerBody()?['status'],'complete')","and(outputs('Step1'),not(empty(triggerBody()?['eventId'])))","if(outputs('Step2'),'Process','Ignore')"]
};
export function localizedLesson(lesson,lang='en'){
 if(lang!=='es'||!ES[lesson.id])return lesson;
 const t=ES[lesson.id];
 return {...lesson,title:t.title,subtitle:t.subtitle,goal:t.goal,
   steps:lesson.steps.map((step,i)=>({...step,title:t.steps[i]?.[0]||step.title,instruction:t.steps[i]?.[1]||step.instruction,why:t.steps[i]?.[2]||step.why,hint:ES_HINTS[lesson.id]?.[i]||step.hint}))};
}
