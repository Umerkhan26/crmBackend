import User from "../models/user.model";
import Lead from "../models/lead.model";
import ProductSale from "../models/product.model";
import Campaign from "../models/campaign.model";
import { Op, Sequelize } from "sequelize";

/**
 * Get dashboard statistics
 * Optimized single query approach for all counts
 */
export const getDashboardStats = async () => {
  try {
    // Execute all count queries in parallel for better performance
    const [
      totalUsers,
      activeUsers,
      blockedUsers,
      totalLeads,
      assignedLeadsCount,
      unassignedLeadsCount,
      totalProducts,
      totalCampaigns,
    ] = await Promise.all([
      // Total Users
      User.count(),

      // Active Users
      User.count({
        where: { status: "active" },
      }),

      // Blocked Users
      User.count({
        where: { status: "blocked" },
      }),

      // Total Leads
      Lead.count(),

      // Assigned Leads - count leads where assignees JSON array has at least one item
      Lead.count({
        where: Sequelize.literal("JSON_LENGTH(COALESCE(assignees, '[]')) > 0"),
      }),

      // Unassigned Leads - count leads where assignees is null, empty, or empty array
      Lead.count({
        where: Sequelize.literal("(assignees IS NULL OR assignees = '[]' OR assignees = '' OR JSON_LENGTH(COALESCE(assignees, '[]')) = 0)"),
      }),

      // Total Products (pending status)
      ProductSale.count({
        where: { status: "pending" },
      }),

      // Total Campaigns
      Campaign.count({
        distinct: true,
        col: "campaignName",
      }),
    ]);

    return {
      users: {
        total: totalUsers,
        active: activeUsers,
        blocked: blockedUsers,
      },
      leads: {
        total: totalLeads,
        assigned: assignedLeadsCount,
        unassigned: unassignedLeadsCount,
      },
      products: {
        total: totalProducts,
      },
      campaigns: {
        total: totalCampaigns,
      },
    };
  } catch (error: any) {
    throw new Error(`Error fetching dashboard stats: ${error.message}`);
  }
};

