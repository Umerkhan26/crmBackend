import { Op, Sequelize } from "sequelize";
import Lead from "../models/lead.model";
import User from "../models/user.model";
import Campaign from "../models/campaign.model";
import Order from "../models/order.model";
import ProductSale from "../models/product.model";
import Role from "../models/role.model";
import ClientLead from "../models/clientLead.model";
import ActivityLog from "../models/activityLog.model";

interface MasterSearchResult {
  leads: any[];
  users: any[];
  campaigns: any[];
  orders: any[];
  products: any[];
  roles: any[];
  clientLeads: any[];
  activityLogs: any[];
  totals: {
    leads: number;
    users: number;
    campaigns: number;
    orders: number;
    products: number;
    roles: number;
    clientLeads: number;
    activityLogs: number;
  };
}

export const masterSearch = async (
  query: string,
  limit: number = 5,
  userId?: number,
  allowedCampaignNames?: string[]
): Promise<MasterSearchResult> => {
  if (!query || query.trim().length === 0) {
    return {
      leads: [],
      users: [],
      campaigns: [],
      orders: [],
      products: [],
      roles: [],
      clientLeads: [],
      activityLogs: [],
      totals: {
        leads: 0,
        users: 0,
        campaigns: 0,
        orders: 0,
        products: 0,
        roles: 0,
        clientLeads: 0,
        activityLogs: 0,
      },
    };
  }

  const searchTerm = `%${query.trim()}%`;
  const numericId = isNaN(Number(query)) ? undefined : Number(query);
  
  // Check if query might be a leadCode (letters followed by numbers, e.g., "ABC123")
  // Extract numeric part if it looks like a leadCode
  const leadCodeMatch = query.trim().match(/^([A-Za-z]+)(\d+)$/i);
  const leadCodeNumericId = leadCodeMatch ? Number(leadCodeMatch[2]) : undefined;
  const leadCodePrefix = leadCodeMatch ? leadCodeMatch[1].toUpperCase() : null;
  
  // Also check if query is just letters (might be campaign initials prefix)
  const isLettersOnly = /^[A-Za-z]+$/.test(query.trim());

  // Build where conditions for each entity
  const leadWhere: any = {
    [Op.or]: [{ campaignName: { [Op.like]: searchTerm } }],
  };
  if (numericId !== undefined) {
    leadWhere[Op.or].push({ id: numericId });
  }
  // If query looks like a leadCode, also search by the numeric ID part
  if (leadCodeNumericId !== undefined) {
    leadWhere[Op.or].push({ id: leadCodeNumericId });
  }
  // If query is just letters, also search for campaigns starting with those letters
  if (isLettersOnly && !leadCodeMatch) {
    leadWhere[Op.or].push({ campaignName: { [Op.like]: `${query.trim()}%` } });
  }

  // For non-admin users, filter leads by assignment and campaign permissions
  if (userId && allowedCampaignNames !== undefined) {
    if (allowedCampaignNames.length === 0) {
      // User has no campaign permissions - return empty results
      leadWhere[Op.and] = [Sequelize.literal("1 = 0")]; // Always false condition
    } else {
      // User has specific campaign permissions
      // Build condition: (assigned to user) AND (campaign in allowed campaigns)
      const assignmentCondition = Sequelize.literal(
        `JSON_CONTAINS(COALESCE(assignees, '[]'), JSON_OBJECT('userId', ${userId}), '$')`
      );
      
      // Add campaign filter
      const campaignFilter = { campaignName: { [Op.in]: allowedCampaignNames } };
      
      // Combine: (search conditions) AND (assigned to user) AND (campaign in allowed)
      if (!leadWhere[Op.and]) {
        leadWhere[Op.and] = [];
      }
      leadWhere[Op.and].push(assignmentCondition);
      leadWhere[Op.and].push(campaignFilter);
    }
  }

  const userWhere: any = {
    [Op.or]: [
      { firstname: { [Op.like]: searchTerm } },
      { lastname: { [Op.like]: searchTerm } },
      { email: { [Op.like]: searchTerm } },
    ],
  };
  if (numericId !== undefined) {
    userWhere[Op.or].push({ id: numericId });
  }

  const campaignWhere: any = {
    [Op.or]: [{ campaignName: { [Op.like]: searchTerm } }],
  };
  if (numericId !== undefined) {
    campaignWhere[Op.or].push({ id: numericId });
  }

  // For non-admin users, filter campaigns by permissions
  if (userId && allowedCampaignNames !== undefined) {
    if (allowedCampaignNames.length > 0) {
      // User has specific campaign permissions - filter by those campaigns
      campaignWhere.campaignName = { [Op.in]: allowedCampaignNames };
    } else {
      // User has no campaign permissions - return empty results
      campaignWhere[Op.and] = [Sequelize.literal("1 = 0")]; // Always false condition
    }
  }

  const orderWhere: any = {
    [Op.or]: [
      { agent: { [Op.like]: searchTerm } },
      { state: { [Op.like]: searchTerm } },
    ],
  };
  if (numericId !== undefined) {
    orderWhere[Op.or].push({ id: numericId });
  }

  const productWhere: any = {
    [Op.or]: [{ productType: { [Op.like]: searchTerm } }],
  };
  if (numericId !== undefined) {
    productWhere[Op.or].push({ id: numericId });
  }

  const roleWhere: any = {
    [Op.or]: [{ name: { [Op.like]: searchTerm } }],
  };
  if (numericId !== undefined) {
    roleWhere[Op.or].push({ id: numericId });
  }

  const clientLeadWhere: any = {
    [Op.or]: [],
  };
  if (numericId !== undefined) {
    clientLeadWhere[Op.or].push({ id: numericId });
  }
  // ClientLead has leadData JSON, so we'll search in that after fetching

  const activityLogWhere: any = {
    [Op.or]: [
      { action: { [Op.like]: searchTerm } },
      { details: { [Op.like]: searchTerm } },
    ],
  };

  // For non-admin users, hide certain entities (users, roles, etc.)
  const shouldHideEntities = userId && allowedCampaignNames !== undefined;

  // Search all entities in parallel
  const [
    leads,
    users,
    campaigns,
    orders,
    products,
    roles,
    clientLeads,
    activityLogs,
  ]: [
    any[],
    any[],
    any[],
    any[],
    any[],
    any[],
    any[],
    any[],
  ] = await Promise.all([
    // Search Leads - search in campaignName and by ID
    // Note: leadData JSON search is done after fetching for safety
    // Fetch more leads if searching by leadCode pattern to ensure we catch all matches
    Lead.findAll({
      where: leadWhere,
      limit: (leadCodeMatch || isLettersOnly) ? limit * 5 : limit * 2, // Fetch more for leadCode searches
      order: [["id", "DESC"]],
      attributes: ["id", "campaignName", "leadData"],
    }),

    // Search Users (only for admin)
    shouldHideEntities ? Promise.resolve([]) : User.findAll({
      where: userWhere,
      limit,
      order: [["id", "DESC"]],
      attributes: ["id", "firstname", "lastname", "email"],
    }),

    // Search Campaigns
    Campaign.findAll({
      where: campaignWhere,
      limit,
      order: [["id", "DESC"]],
      attributes: ["id", "campaignName", "fields"],
    }),

    // Search Orders (only for admin)
    shouldHideEntities ? Promise.resolve([]) : Order.findAll({
      where: orderWhere,
      limit,
      order: [["created_at", "DESC"]],
      attributes: ["id", "agent", "state", "campaign_id", "created_at"],
      include: [
        {
          model: Campaign,
          as: "campaign",
          attributes: ["id", "campaignName"],
        },
      ],
    }),

    // Search Products (ProductSales) - only for admin
    shouldHideEntities ? Promise.resolve([]) : ProductSale.findAll({
      where: productWhere,
      limit,
      order: [["id", "DESC"]],
      attributes: ["id", "productType", "price", "status"],
    }),

    // Search Roles (only for admin)
    shouldHideEntities ? Promise.resolve([]) : Role.findAll({
      where: roleWhere,
      limit,
      order: [["id", "DESC"]],
      attributes: ["id", "name"],
    }),

    // Search Client Leads - search in leadData JSON (only for admin)
    shouldHideEntities ? Promise.resolve([]) : ClientLead.findAll({
      where: clientLeadWhere,
      limit: limit * 2, // Fetch more to filter by leadData
      order: [["id", "DESC"]],
      attributes: ["id", "leadData"],
    }),

    // Search Activity Logs (only for admin)
    shouldHideEntities ? Promise.resolve([]) : ActivityLog.findAll({
      where: activityLogWhere,
      limit,
      order: [["created_at", "DESC"]],
      attributes: ["id", "action", "details", "created_at"],
    }),
  ]);

  // Process leads to include leadCode and filter by leadData content
  const queryLower = query.trim().toLowerCase();
  const processedLeads = leads
    .map((lead: any) => {
      const leadData =
        typeof lead.leadData === "string"
          ? JSON.parse(lead.leadData)
          : lead.leadData;

      const initials = lead.campaignName
        .split(" ")
        .map((word: string) => word[0]?.toUpperCase() || "")
        .join("");
      const leadCode = `${initials}${lead.id}`;

      // Check if search term matches any field in leadData
      const leadDataStr = JSON.stringify(leadData || {}).toLowerCase();
      const matchesLeadData = leadDataStr.includes(queryLower);

      return {
        id: lead.id,
        leadCode,
        campaignName: lead.campaignName,
        businessName: leadData?.business_name || leadData?.businessName || "",
        email: leadData?.email || "",
        phone: leadData?.phone || leadData?.phone_number || "",
        createdAt: lead.createdAt,
        _matchesLeadData: matchesLeadData, // Internal flag for filtering
      };
    })
    .filter((lead: any) => {
      // Keep if it matches campaignName, leadCode, ID, or leadData content
      const matchesCampaignName = lead.campaignName.toLowerCase().includes(queryLower);
      const matchesLeadCode = lead.leadCode.toLowerCase().includes(queryLower);
      const matchesLeadData = lead._matchesLeadData;
      
      // If query looks like a leadCode pattern, also check if the prefix matches campaign initials
      let matchesLeadCodePattern = false;
      if (leadCodePrefix) {
        const campaignInitials = lead.campaignName
          .split(" ")
          .map((word: string) => word[0]?.toUpperCase() || "")
          .join("");
        matchesLeadCodePattern = campaignInitials.toUpperCase().includes(leadCodePrefix) && 
                                 lead.id === leadCodeNumericId;
      }
      
      return (
        matchesCampaignName ||
        matchesLeadCode ||
        matchesLeadCodePattern ||
        matchesLeadData
      );
    })
    .slice(0, limit)
    .map(({ _matchesLeadData, ...lead }: any) => lead); // Remove internal flag

  // Process client leads - search in leadData JSON
  const processedClientLeads = clientLeads
    .map((clientLead: any) => {
      const leadData =
        typeof clientLead.leadData === "string"
          ? JSON.parse(clientLead.leadData)
          : clientLead.leadData;

      const leadDataStr = JSON.stringify(leadData || {}).toLowerCase();
      const matchesLeadData = leadDataStr.includes(queryLower);

      return {
        id: clientLead.id,
        name: leadData?.name || leadData?.business_name || leadData?.businessName || "",
        email: leadData?.email || "",
        phone: leadData?.phone || leadData?.phone_number || "",
        createdAt: clientLead.createdAt,
        _matchesLeadData: matchesLeadData,
      };
    })
    .filter((clientLead: any) => {
      return (
        clientLead.name.toLowerCase().includes(queryLower) ||
        clientLead.email.toLowerCase().includes(queryLower) ||
        clientLead.phone.toLowerCase().includes(queryLower) ||
        clientLead._matchesLeadData ||
        numericId !== undefined && clientLead.id === numericId
      );
    })
    .slice(0, limit)
    .map(({ _matchesLeadData, ...clientLead }: any) => clientLead);

  // Get total counts for each entity type
  const [
    usersCount,
    campaignsCount,
    ordersCount,
    productsCount,
    rolesCount,
    activityLogsCount,
  ]: [number, number, number, number, number, number] =
    await Promise.all([
      shouldHideEntities ? Promise.resolve(0) : User.count({ where: userWhere }),
      Campaign.count({ where: campaignWhere }),
      shouldHideEntities ? Promise.resolve(0) : Order.count({ where: orderWhere }),
      shouldHideEntities ? Promise.resolve(0) : ProductSale.count({ where: productWhere }),
      shouldHideEntities ? Promise.resolve(0) : Role.count({ where: roleWhere }),
      shouldHideEntities ? Promise.resolve(0) : ActivityLog.count({ where: activityLogWhere }),
    ]);

  return {
    leads: processedLeads,
    users: users.map((u: any) => u.toJSON()),
    campaigns: campaigns.map((c: any) => c.toJSON()),
    orders: orders.map((o: any) => ({
      ...o.toJSON(),
      campaignName: o.campaign?.campaignName || "",
    })),
    products: products.map((p: any) => ({
      ...p.toJSON(),
      name: p.productType,
    })),
    roles: roles.map((r: any) => r.toJSON()),
    clientLeads: processedClientLeads,
    activityLogs: activityLogs.map((al: any) => al.toJSON()),
    totals: {
      leads: processedLeads.length, // Use filtered count since we filter by leadData
      users: usersCount,
      campaigns: campaignsCount,
      orders: ordersCount,
      products: productsCount,
      roles: rolesCount,
      clientLeads: processedClientLeads.length, // Use filtered count since we filter by leadData
      activityLogs: activityLogsCount,
    },
  };
};

