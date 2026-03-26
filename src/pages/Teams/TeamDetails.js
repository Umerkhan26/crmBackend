import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  Badge,
  Breadcrumb,
  BreadcrumbItem,
  Button,
  Card,
  CardBody,
  Container,
  Spinner,
} from "reactstrap";
import { toast } from "react-toastify";
import TableContainer from "../../components/Common/TableContainer";
import AssignUsersToTeamModal from "../../components/Modals/AssignUsersToTeamModal";
import { getTeamById, getTeamMembers, setTeamMemberStatus } from "../../services/teamService";
import { useSelector } from "react-redux";
import { hasAnyPermission } from "../../utils/permissions";

const TeamDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [team, setTeam] = useState(null);
  const [loading, setLoading] = useState(true);
  const [membersLoading, setMembersLoading] = useState(false);
  const [members, setMembers] = useState([]);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [pagination, setPagination] = useState({
    currentPage: 1,
    pageSize: 20,
    totalItems: 0,
    totalPages: 1,
  });

  const currentUser = useSelector((state) => state.Login?.user);
  const reduxPermissions = useSelector((state) => state.Permissions?.permissions);
  const canManageMembers = hasAnyPermission(currentUser, ["team:manageMembers"], reduxPermissions);

  const fetchTeam = async () => {
    try {
      setLoading(true);
      const resp = await getTeamById(id);
      if (resp.success && resp.data) setTeam(resp.data);
      else throw new Error("Team not found");
    } catch (e) {
      toast.error(e.message || "Failed to fetch team");
      navigate("/teams");
    } finally {
      setLoading(false);
    }
  };

  const fetchMembers = async () => {
    try {
      setMembersLoading(true);
      const resp = await getTeamMembers({
        teamId: id,
        page: pagination.currentPage,
        limit: pagination.pageSize,
        search: "",
        status: "all",
      });
      if (resp.success) {
        setMembers(resp.data || []);
        setPagination((p) => ({
          ...p,
          totalItems: resp.totalItems || 0,
          totalPages: resp.totalPages || 1,
          currentPage: resp.currentPage || 1,
        }));
      }
    } catch (e) {
      toast.error(e.message || "Failed to fetch members");
    } finally {
      setMembersLoading(false);
    }
  };

  useEffect(() => {
    fetchTeam();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    if (team) fetchMembers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [team, pagination.currentPage]);

  const handleToggleMember = async (row) => {
    try {
      const memberStatus = row.status === "active" ? "inactive" : "active";
      await setTeamMemberStatus(id, row.userId, memberStatus);
      toast.success("Member updated");
      fetchMembers();
    } catch (e) {
      toast.error(e.message || "Failed to update member");
    }
  };

  const columns = useMemo(
    () => [
      {
        Header: "Name",
        accessor: "user.firstname",
        disableFilters: true,
        Cell: ({ row }) => (
          <span>
            {row.original?.user?.firstname || "-"} {row.original?.user?.lastname || ""}
          </span>
        ),
      },
      { Header: "Email", accessor: "user.email", disableFilters: true },
      {
        Header: "Role",
        accessor: "user.role.name",
        disableFilters: true,
        Cell: ({ value }) => (
          <Badge color="success" className="text-capitalize">
            {value || "N/A"}
          </Badge>
        ),
      },
      {
        Header: "Member Status",
        accessor: "status",
        disableFilters: true,
        Cell: ({ value }) => (
          <Badge color={value === "inactive" ? "danger" : "success"}>
            {value === "inactive" ? "Inactive" : "Active"}
          </Badge>
        ),
      },
      ...(canManageMembers
        ? [
            {
              Header: "Action",
              accessor: "userId",
              disableFilters: true,
              width: 140,
              Cell: ({ row }) => (
                <Button
                  size="sm"
                  color={row.original.status === "active" ? "danger" : "primary"}
                  onClick={() => handleToggleMember(row.original)}
                >
                  {row.original.status === "active" ? "Deactivate" : "Activate"}
                </Button>
              ),
            },
          ]
        : []),
    ],
    [canManageMembers],
  );

  return (
    <Container fluid>
      <Breadcrumb className="py-2">
        <BreadcrumbItem>
          <Button color="link" className="p-0" onClick={() => navigate("/teams")}>
            Teams
          </Button>
        </BreadcrumbItem>
        <BreadcrumbItem active>Details</BreadcrumbItem>
      </Breadcrumb>

      {loading ? (
        <div className="text-center py-4">
          <Spinner />
        </div>
      ) : (
        <Card>
          <CardBody>
            <div className="d-flex justify-content-between align-items-center mb-2">
              <div>
                <h5 className="mb-1">{team?.name}</h5>
                <div className="text-muted">
                  Code: <b>{team?.code}</b> | Order: <b>{team?.sortOrder}</b> |{" "}
                  <Badge color={team?.status === "inactive" ? "danger" : "success"}>
                    {team?.status === "inactive" ? "Inactive" : "Active"}
                  </Badge>
                </div>
              </div>
              {canManageMembers && (
                <Button color="primary" onClick={() => setIsAddModalOpen(true)}>
                  Add Members
                </Button>
              )}
            </div>

            {membersLoading ? (
              <div className="text-center py-4">
                <Spinner />
              </div>
            ) : (
              <TableContainer
                columns={columns}
                data={members}
                isGlobalFilter={false}
                isPagination={false}
                customPageSize={pagination.pageSize}
                className="custom-header-css"
              />
            )}
          </CardBody>
        </Card>
      )}

      <AssignUsersToTeamModal
        isOpen={isAddModalOpen}
        toggle={() => setIsAddModalOpen((v) => !v)}
        teamId={id}
        onSuccess={() => {
          fetchMembers();
          fetchTeam();
        }}
      />
    </Container>
  );
};

export default TeamDetails;

