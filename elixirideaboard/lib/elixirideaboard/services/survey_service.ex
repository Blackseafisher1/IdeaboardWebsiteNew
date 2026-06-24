defmodule Elixirideaboard.SurveyService do
  use AyeSQL, runner: Elixirideaboard.RepoRunner, repo: Elixirideaboard.Repo

  defqueries("../queries/surveys.sql")

  def list do
    case list_surveys(%{}) do
      {:ok, surveys} -> surveys
      _ -> []
    end
  end

  def get(id) do
    case get_survey(id: id) do
      {:ok, [survey]} ->
        {:ok, questions} = get_questions(survey_id: id)
        questions = Enum.map(questions, fn q ->
          {:ok, options} = get_options(question_id: q.question_id)
          Map.put(q, :options, options)
        end)
        %{survey: survey, questions: questions}
      _ -> nil
    end
  end

  def create(attrs) do
    case create_survey(
      title: attrs.title,
      description: attrs.description,
      creator_id: attrs.creator_id,
      is_anonymous: if(attrs.is_anonymous, do: 1, else: 0),
      expires_at: attrs.expires_at
    ) do
      {:ok, %{last_insert_id: id}} -> {:ok, id}
      error -> error
    end
  end
end
