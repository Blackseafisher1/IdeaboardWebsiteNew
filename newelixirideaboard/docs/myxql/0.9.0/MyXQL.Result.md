# `MyXQL.Result`
[🔗](https://github.com/elixir-ecto/myxql/blob/v0.9.0/lib/myxql/result.ex#L1)

Result struct returned from any successful query.

Its public fields are:

  * `:columns` - The column names;
  * `:connection_id` - The connection ID;
  * `:last_insert_id` - The ID of the last inserted row;
  * `:num_rows` - The number of fetched or affected rows;
  * `:rows` - The result set. A list of lists, each inner list corresponding to a
    row, each element in the inner list corresponds to a column;
  * `:num_warnings` - The number of warnings

## Warnings

Depending on SQL MODE, a given query may error or just return warnings.
If `result.num_warnings` is non-zero it means there were warnings and they can be
retrieved by making another query:

    MyXQL.query!(conn, "SHOW WARNINGS", [], query_type: :text)

# `t`

```elixir
@type t() :: %MyXQL.Result{
  columns: [String.t()] | nil,
  connection_id: pos_integer(),
  last_insert_id: term() | nil,
  num_rows: non_neg_integer() | nil,
  num_warnings: non_neg_integer(),
  rows: [[term()]] | nil
}
```

---

*Consult [api-reference.md](api-reference.md) for complete listing*
