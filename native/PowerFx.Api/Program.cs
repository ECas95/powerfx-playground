using System.Diagnostics;
using System.Globalization;
using System.Text.Json;
using System.Text.Json.Nodes;
using Microsoft.PowerFx;
using Microsoft.PowerFx.Types;

// Optional native engine (Power Fx SDK), only bound to localhost.
// Keep this service private behind the Node portal. Do not enable connectors or tenant actions.
var builder = WebApplication.CreateBuilder(args);
builder.WebHost.UseUrls("http://127.0.0.1:5196");
var app = builder.Build();

app.MapGet("/health", () => Results.Ok(new { ok = true, engine = "Microsoft.PowerFx.Interpreter" }));
app.MapPost("/evaluate", async (EvalRequest request, CancellationToken ct) =>
{
    var clock = Stopwatch.StartNew();
    try
    {
        if (string.IsNullOrWhiteSpace(request.Formula) || request.Formula.Length > 12000)
            return Results.UnprocessableEntity(Fail("Formula is empty or too long"));
        if (request.Inputs.ValueKind is not (JsonValueKind.Object or JsonValueKind.Undefined))
            return Results.UnprocessableEntity(Fail("Inputs must be an object"));

        var culture = CultureInfo.GetCultureInfo(request.Locale ?? "en-US");
        var options = new ParserOptions { Culture = culture };
        var engine = new RecalcEngine();
        if (request.Inputs.ValueKind == JsonValueKind.Object)
        {
            foreach (var entry in request.Inputs.EnumerateObject())
            {
                // JSON object/array values become Power Fx Record/Table objects.
                FormulaValue input = FormulaValueJSON.FromJson(entry.Value.GetRawText());
                if (input is ErrorValue)
                    return Results.UnprocessableEntity(Fail($"Invalid JSON value for '{entry.Name}'"));
                engine.UpdateVariable(entry.Name, input);
            }
        }

        FormulaValue value = await engine.EvalAsync(request.Formula, ct, RecordValue.Empty(), options);
        if (value is ErrorValue)
            return Results.UnprocessableEntity(Fail($"Power Fx runtime error: {value}"));

        // ToObject() maps Power Fx values into CLR primitives/records/tables.
        object? output = value.ToObject();
        var payload = new Dictionary<string, object?>
        {
            ["success"] = true,
            ["platform"] = "canvas",
            ["engine"] = "microsoft-powerfx-native",
            ["value"] = output,
            ["valueType"] = value.Type.ToString(),
            ["elapsedMs"] = Math.Round(clock.Elapsed.TotalMilliseconds, 2)
        };
        if (request.Expected.HasValue)
        {
            var expected = JsonNode.Parse(request.Expected.Value.GetRawText());
            var actual = JsonSerializer.SerializeToNode(output);
            payload["assertion"] = new { passed = JsonNode.DeepEquals(actual, expected), expected };
        }
        return Results.Ok(payload);
    }
    catch (OperationCanceledException)
    {
        return Results.UnprocessableEntity(Fail("Evaluation cancelled"));
    }
    catch (Exception error)
    {
        return Results.UnprocessableEntity(Fail(error.Message));
    }
});

app.Run();

static object Fail(string message) => new { success = false, error = new { message, code = "POWERFX_NATIVE_ERROR", position = (int?)null } };

public record EvalRequest(string Formula, JsonElement Inputs, string? Locale, JsonElement? Expected);
