import Link from "next/link";

type ProjectSearchProps = {
  action: string;
  query?: string;
  placeholder?: string;
  resultCount?: number;
};

export function ProjectSearch({
  action,
  query = "",
  placeholder = "Search reference, job, client or site",
  resultCount,
}: ProjectSearchProps) {
  return (
    <form className="project-search" action={action} method="get">
      <label>
        <span>Search</span>
        <input
          name="q"
          type="search"
          defaultValue={query}
          placeholder={placeholder}
          autoComplete="off"
        />
      </label>
      <button className="primary-button" type="submit">
        Search
      </button>
      {query ? (
        <Link className="secondary-button" href={action}>
          Clear
        </Link>
      ) : null}
      {typeof resultCount === "number" ? (
        <small>
          {resultCount} result{resultCount === 1 ? "" : "s"}
        </small>
      ) : null}
    </form>
  );
}
