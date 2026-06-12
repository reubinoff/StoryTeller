import { TOPICS } from "~/lib/topics";
import { COURSES } from "../db";
import { err, ok, pathParts, type MockRequest, type MockResponse } from "../router";

export function handleCatalog(req: MockRequest): MockResponse<unknown> | null {
  const { pathname } = pathParts(req.url);

  if (req.method === "GET" && pathname === "/interests") {
    return ok(TOPICS);
  }
  if (req.method === "GET" && pathname === "/courses") {
    return ok(COURSES);
  }
  const courseMatch = pathname.match(/^\/courses\/([^/]+)$/);
  if (req.method === "GET" && courseMatch) {
    const id = courseMatch[1];
    const course = COURSES.find((c) => c.id === id);
    if (!course) return err(404, "not_found", "Course not found");
    return ok(course);
  }
  return null;
}
