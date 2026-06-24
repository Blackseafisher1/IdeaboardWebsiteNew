# `AyeSQL`
[🔗](https://github.com/alexdesousa/ayesql/blob/v1.1.4/lib/ayesql.ex#L1)

_AyeSQL_ is a library for using raw SQL.

> **Aye** _/ʌɪ/_ _exclamation (archaic dialect)_: said to express assent; yes.

## Overview

Inspired by Clojure library [Yesql](https://github.com/krisajenkins/yesql),
_AyeSQL_ tries to find a middle ground between strings with raw SQL queries and
SQL DSLs by:

- Keeping SQL in SQL files.
- Generating Elixir functions for every query.
- Supporting mandatory and optional named parameters.
- Allowing query composability with ease.
- Working out of the box with PostgreSQL using
  [Ecto](https://github.com/elixir-ecto/ecto_sql) or
  [Postgrex](https://github.com/elixir-ecto/postgrex):
- Being extended to support other databases using the behaviour
  `AyeSQL.Runner`.

## Small Example

Let's say we have a
[SQL query](https://stackoverflow.com/questions/39556763/use-ecto-to-generate-series-in-postgres-and-also-retrieve-null-values-as-0)
to retrieve the click count of a certain type of link every day of the last `X`
days. In raw SQL this could be written as:

```sql
    WITH computed_dates AS (
           SELECT dates::date AS date
             FROM generate_series(
                    current_date - $1::interval,
                    current_date - interval '1 day',
                    interval '1 day'
                  ) AS dates
         )
  SELECT dates.date AS day, count(clicks.id) AS count
    FROM computed_dates AS dates
         LEFT JOIN clicks AS clicks ON date(clicks.inserted_at) = dates.date
   WHERE clicks.link_id = $2
GROUP BY dates.date
ORDER BY dates.date;
```

The equivalent query in Ecto would be:

```elixir
dates = ~s(
SELECT generate_series(
         current_date - ?::interval,
         current_date - interval '1 day',
         interval '1 day'
       )::date AS d
)

from(
  c in "clicks",
  right_join: day in fragment(dates, ^days),
  on: day.d == fragment("date(?)", c.inserted_at),
  where: c.link_id = ^link_id
  group_by: day.d,
  order_by: day.d,
  select: %{
    day: fragment("date(?)", day.d),
    count: count(c.id)
  }
)
```

Using fragments can get convoluted and difficult to maintain. In AyeSQL, the
equivalent would be to create an SQL file with the query e.g. `queries.sql`:

```sql
-- name: get_day_interval
SELECT datetime::date AS date
  FROM generate_series(
        current_date - :days::interval, -- Named parameter :days
        current_date - interval '1 day',
        interval '1 day'
      );

-- name: get_avg_clicks
-- docs: Gets average click count.
    WITH computed_dates AS ( :get_day_interval ) -- Composing with another query
  SELECT dates.date AS day, count(clicks.id) AS count
    FROM computed_date AS dates
        LEFT JOIN clicks AS clicks ON date(clicks.inserted_at) = dates.date
  WHERE clicks.link_id = :link_id -- Named parameter :link_id
GROUP BY dates.date
ORDER BY dates.date;
```

In Elixir, we would load all the queries in this file by creating the following
module:

```elixir
defmodule Queries do
  use AyeSQL, repo: MyRepo

  defqueries("queries.sql") # File name with relative path to SQL file.
end
```

or using the macro `defqueries/3`:

```elixir
import AyeSQL, only: [defqueries: 3]

defqueries(Queries, "queries.sql", repo: MyRepo)
```

Both approaches will create a module called `Queries` with all the queries
defined in `queries.sql`.

And then we could execute the query as follows:

```elixir
iex> params = [
...>   link_id: 42,
...>   days: %Postgrex.Interval{secs: 864_000} # 10 days
...> ]
iex> Queries.get_avg_clicks(params)
{:ok,
  [
    %{day: ..., count: ...},
    %{day: ..., count: ...},
    %{day: ..., count: ...},
    ...
  ]
}
```
AyeSQL also allows you to choose the type of returned data structures.
Instead of the default map you can also pass an `into` option to your query
possible values are:
- an empty map: `Map.new()` or `%{}`
- an empty list: `Keyword.new()` or `[]`
- a struct
- `:raw` which returns the unmodified Postgrex result

```elixir
iex> Queries.get_avg_clicks(params, into: [])
{:ok,
  [
    [day: ..., count: ...],
    [day: ..., count: ...],
    [day: ..., count: ...],
    ...
  ]
}
```

```elixir
iex> defmodule AvgClicks do defstruct [:day, :count] end
iex> Queries.get_avg_clicks(params, into: AvgClicks)
{:ok,
  [
    %AvgClicks{day: ..., count: ...},
    %AvgClicks{day: ..., count: ...},
    %AvgClicks{day: ..., count: ...},
    ...
  ]
}
```

# `__using__`
*macro* 

```elixir
@spec __using__(keyword()) :: Macro.t()
```

Uses `AyeSQL` for loading queries.

By default, supports the option `runner` (see `AyeSQL.Runner` behaviour).

Any other option will be passed to the runner.

# `defqueries`
*macro* 

```elixir
@spec defqueries(Path.t() | [Path.t()]) :: [Macro.t()]
```

Macro to load queries from a `file`.

Let's say we have the file `lib/sql/queries.sql` with the following contents:

```sql
-- name: get_user
-- docs: Gets user by username
SELECT *
  FROM users
 WHERE username = :username;
```

Then we can load our queries to Elixir using the macro `defqueries/1`:

```
# file: lib/queries.ex
defmodule Queries do
  use AyeSQL, repo: MyRepo

  defqueries("sql/queries.sql")
end
```

## Multi-file Support

You can load queries from multiple files using a list or glob patterns:

```
# file: lib/queries.ex
defmodule Queries do
  use AyeSQL, repo: MyRepo

  # List of files
  defqueries(["sql/users.sql", "sql/posts.sql", "sql/comments.sql"])

  # Or using glob patterns
  defqueries("sql/**/*.sql")
end
```

**Important notes for multi-file usage:**
- Files matched by glob patterns are processed in alphabetical order
- All query names must be unique across all files
- Each file is tracked as an `@external_resource` for recompilation
- Queries can reference other queries from any file using `:query_name` syntax

or the macro `defqueries/3`:

```
# file: lib/queries.ex
import AyeSQL, only: [defqueries: 3]

defqueries(Queries, "sql/queries.ex", repo: MyRepo)

# Multi-file examples
defqueries(Queries, ["sql/users.sql", "sql/posts.sql"], repo: MyRepo)
defqueries(Queries, "sql/**/*.sql", repo: MyRepo)
```

And finally we can inspect the query:

```
iex(1)> Queries.get_user(username: "some_user", run: false)
{:ok,
  %AyeSQL.Query{
    statement: "SELECT * FROM user WHERE username = $1",
    arguments: ["some_user"]
  }
}
```

or run it:

```
iex(1)> Queries.get_user(username: "some_user")
{:ok,
  [
    %{username: ..., ...}
  ]
}
```

# `defqueries`
*macro* 

```elixir
@spec defqueries(module(), Path.t() | [Path.t()], keyword()) :: Macro.t()
```

Macro to load queries from one or more files and create a module for them.

Same as `defqueries/1`, but creates a module e.g for the query file
`lib/sql/queries.sql` we can use this macro as follows:

```
# file: lib/queries.ex
import AyeSQL, only: [defqueries: 3]

defqueries(Queries, "sql/queries.sql", repo: MyRepo)
```

## Multi-file Support

You can also load from multiple files or glob patterns:

```
# List of files
defqueries(Queries, ["sql/users.sql", "sql/posts.sql"], repo: MyRepo)

# Glob pattern
defqueries(Queries, "sql/**/*.sql", repo: MyRepo)
```

This will generate the module `Queries` and it'll contain all the SQL
statements included in the specified file(s). See `defqueries/1` for more
details on multi-file behavior.

# `eval_query`

```elixir
@spec eval_query(binary(), AyeSQL.Lexer.options()) ::
  (AyeSQL.Core.parameters(), AyeSQL.Core.options() -&gt;
     {:ok, AyeSQL.Query.t() | term()} | {:error, AyeSQL.Error.t() | term()})
  | no_return()
```

Evaluates the `contents` of a string with a query and generates an anonyous
function that receives parameters and options.

---

*Consult [api-reference.md](api-reference.md) for complete listing*
