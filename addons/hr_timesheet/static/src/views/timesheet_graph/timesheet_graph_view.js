/** @odoo-module **/

import { projectGraphView } from "@project/views/project_task_graph/project_graph_view";
import { hrTimesheetGraphModel } from "./timesheet_graph_model";
import { registry } from "@web/core/registry";

const viewRegistry = registry.category("views");

export const hrTimesheetGraphView = {
  ...projectGraphView,
  Model: hrTimesheetGraphModel,
};

viewRegistry.add("hr_timesheet_graphview", hrTimesheetGraphView);
