# `MyXQL.Queries`
[🔗](https://github.com/elixir-ecto/myxql/blob/v0.8.2/lib/myxql/query.ex#L38)

A struct for a prepared statement that returns multiple results.

An example use case is a stored procedure with multiple `SELECT`
statements.

Its public fields are:

  * `:name` - The name of the prepared statement;
  * `:num_params` - The number of parameter placeholders;
  * `:statement` - The prepared statement

## Named and Unnamed Queries

Named queries are identified by the non-empty value in `:name` field
and are meant to be re-used.

Unnamed queries, with `:name` equal to `""`, are automatically closed
after being executed.

# `t`

```elixir
@type t() :: %MyXQL.Queries{
  cache: :reference | :statement,
  name: iodata(),
  num_params: non_neg_integer(),
  ref: term(),
  statement: iodata(),
  statement_id: term()
}
```

---

*Consult [api-reference.md](api-reference.md) for complete listing*
