import type { FastifyInstance } from "fastify";
import { roleService } from "@/services/role.service.js";
import { success } from "@/utils/index.js";
import { notFound, routeHandler } from "@/utils/route-errors.js";
import { roleRouteSchemas } from "./schemas.js";
import type { RoleListQuery, RoleMutationBody } from "./types.js";

const ROLE_NOT_FOUND_MESSAGE = "Role not found";

export const registerRoleRoutes = async (app: FastifyInstance) => {
  app.get<{ Querystring: RoleListQuery }>(
    "/roles",
    { schema: roleRouteSchemas.listRoles },
    routeHandler("Failed to list roles", async (request) => {
      return success(
        roleService.listRoles({
          userId: request.authUser!.id,
          status: request.query.status,
          sortBy: request.query.sortBy,
          sortOrder: request.query.sortOrder,
        }),
      );
    }),
  );

  app.get<{ Params: { id: string } }>(
    "/roles/:id",
    { schema: roleRouteSchemas.getRole },
    routeHandler("Failed to get role", async (request) => {
      const role = roleService.getRoleById(
        request.params.id,
        request.authUser!.id,
      );
      if (!role) {
        throw notFound(ROLE_NOT_FOUND_MESSAGE);
      }
      return success(role);
    }),
  );

  app.post<{ Body: RoleMutationBody }>(
    "/roles",
    { schema: roleRouteSchemas.createRole },
    routeHandler("Failed to create role", async (request) => {
      const role = roleService.createRole({
        userId: request.authUser!.id,
        ...request.body,
      });
      return success(role, "Role created");
    }),
  );

  app.patch<{ Params: { id: string }; Body: RoleMutationBody }>(
    "/roles/:id",
    { schema: roleRouteSchemas.updateRole },
    routeHandler("Failed to update role", async (request) => {
      const role = roleService.updateRole(
        request.params.id,
        request.authUser!.id,
        request.body,
      );
      if (!role) {
        throw notFound(ROLE_NOT_FOUND_MESSAGE);
      }
      return success(role, "Role updated");
    }),
  );

  app.delete<{ Params: { id: string } }>(
    "/roles/:id",
    { schema: roleRouteSchemas.deleteRole },
    routeHandler("Failed to delete role", async (request) => {
      const deleted = roleService.deleteRole(
        request.params.id,
        request.authUser!.id,
      );
      if (!deleted) {
        throw notFound(ROLE_NOT_FOUND_MESSAGE);
      }
      return success({ deleted: true }, "Role deleted");
    }),
  );
};
