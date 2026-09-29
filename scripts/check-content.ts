import meals from "../content/meals.json";
import members from "../content/members.json";
import plan from "../content/plan.json";
import { parsePlan } from "./plan";

parsePlan(plan, meals, members);
