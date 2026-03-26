import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Badge,
  Button,
  Card,
  CardBody,
  Container,
  Spinner,
  Breadcrumb,
  BreadcrumbItem,
} from "reactstrap";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { debounce } from "lodash";
import { FiEye, FiEdit2, FiTrash2 } from "react-icons/fi";
import TableContainer from "../../components/Common/TableContainer";
import useDeleteConfirmation from "../../components/Modals/DeleteConfirmation";
import TeamForm from "../../components/Modals/TeamForm";
import { deleteTeam, getAllTeams, getTeamById, seedDefaultTeams } from "../../services/teamService";
import { useSelector } from "react-redux";
import { hasAnyPermission } from "../../utils/permissions";

const Teams = () => {
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchText, setSearchText] = useState("");
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [selectedTeam, setSelectedTeam] = useState(null);
  const [pagination, setPagination] = useState({
    currentPage: 1,
    pageSize: 100,
    totalItems: 0,
    totalPages: 1,
  });

  const { confirmDelete } = useDeleteConfirmation();
  const navigate = useNavigate();
  const searchInputRef = useRef(null);

  const currentUser = useSelector((state) => state.Login?.user);
  const reduxPermissions = useSelector((state) => state.Permissions?.permissions);

  const canCreate = hasAnyPermission(currentUser, ["team:create"], reduxPermissions);
  const canUpdate = hasAnyPermission(currentUser, ["team:update"], reduxPermissions);
  const canDelete = hasAnyPermission(currentUser, ["team:delete"], reduxPermissions);

  const fetchData = async (currentPage, pageSize, search) => {
    try {
      setLoading(true);
      const resp = await getAllTeams({ page: currentPage, limit: pageSize, search });
      if (!resp.success) throw new Error(resp.message || "Failed to fetch teams");

      setTeams(resp.data || []);
      setPagination((prev) => ({
        ...prev,
        totalItems: resp.totalItems || 0,
        totalPages: resp.totalPages || 1,
        currentPage: resp.currentPage || 1,
      }));
    } catch (e) {
      setError(e.message);
      toast.error(e.message || "Failed to fetch teams");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!currentUser) {
      setLoading(false);
      return;
    }

    if (searchInputRef.current) searchInputRef.current.focus();
    const debouncedFetch = debounce((p, s, q) => fetchData(p, s, q), 400);
    debouncedFetch(pagination.currentPage, pagination.pageSize, searchText);
    return () => debouncedFetch.cancel();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pagination.currentPage, pagination.pageSize, searchText, currentUser]);

  const handleView = (teamId) => navigate(`/teams/${teamId}`);

  const handleEdit = async (teamId) => {
    setLoading(true);
    try {
      const resp = await getTeamById(teamId);
      if (resp.success && resp.data) {
        setSelectedTeam(resp.data);
        setIsFormModalOpen(true);
      }
    } catch (e) {
      toast.error(e.message || "Failed to load team");
    } finally {
      setLoading(false);
    }
  };

  const handleDisable = async (teamId) => {
    const onConfirm = async () => {
      await deleteTeam(teamId);
      setTeams((prev) => prev.map((t) => (t.id === teamId ? { ...t, status: "inactive" } : t)));
    };
    await confirmDelete(onConfirm, null, "team");
  };

  const handleSeed = async () => {
    try {
      setLoading(true);
      const resp = await seedDefaultTeams();
      toast.success(resp.message || "Teams seeded");
      fetchData(pagination.currentPage, pagination.pageSize, searchText);
    } catch (e) {
      toast.error(e.message || "Failed to seed teams");
    } finally {
      setLoading(false);
    }
  };

  const columns = useMemo(
    () => [
      { Header: "Name", accessor: "name", disableFilters: true },
      { Header: "Code", accessor: "code", disableFilters: true, width: 80 },
      {
        Header: "Members",
        accessor: "activeMemberCount",
        disableFilters: true,
        width: 80,
        Cell: ({ value }) => (
          <Badge color="info" style={{ fontSize: "0.65rem", padding: "0.15rem 0.35rem" }}>
            {value ?? 0}
          </Badge>
        ),
      },
      {
        Header: "Status",
        accessor: "status",
        disableFilters: true,
        width: 120,
        Cell: ({ value }) => (
          <Badge color={value === "inactive" ? "danger" : "success"}>
            {value === "inactive" ? "Inactive" : "Active"}
          </Badge>
        ),
      },
      {
        Header: "Action",
        accessor: "id",
        disableFilters: true,
        width: 140,
        Cell: ({ row }) => (
          <div className="d-flex gap-1">
            <Button size="sm" color="info" onClick={() => handleView(row.original.id)} title="View">
              <FiEye size={12} />
            </Button>
            {canUpdate && (
              <Button size="sm" color="warning" onClick={() => handleEdit(row.original.id)} title="Edit">
                <FiEdit2 size={12} />
              </Button>
            )}
            {canDelete && (
              <Button
                size="sm"
                color="danger"
                onClick={() => handleDisable(row.original.id)}
                title="Disable"
              >
                <FiTrash2 size={12} />
              </Button>
            )}
          </div>
        ),
      },
    ],
    [canDelete, canUpdate],
  );

  return (
    <Container fluid>
      <Breadcrumb className="py-2">
        <BreadcrumbItem>
          <span>Settings</span>
        </BreadcrumbItem>
        <BreadcrumbItem active>Teams</BreadcrumbItem>
      </Breadcrumb>

      <Card>
        <CardBody>
          <div className="d-flex justify-content-between align-items-center mb-2">
            <div className="d-flex gap-2 align-items-center">
              <input
                ref={searchInputRef}
                className="form-control"
                style={{ width: 280 }}
                placeholder="Search teams..."
                value={searchText}
                onChange={(e) => {
                  setSearchText(e.target.value);
                  setPagination((p) => ({ ...p, currentPage: 1 }));
                }}
              />
            </div>
            <div className="d-flex gap-2">
              {canCreate && (
                <Button
                  color="primary"
                  onClick={() => {
                    setSelectedTeam(null);
                    setIsFormModalOpen(true);
                  }}
                >
                  Create Team
                </Button>
              )}
              {canCreate && (
                <Button color="secondary" outline onClick={handleSeed}>
                  Seed A–E
                </Button>
              )}
            </div>
          </div>

          {loading ? (
            <div className="text-center py-4">
              <Spinner />
            </div>
          ) : error ? (
            <div className="text-danger">{error}</div>
          ) : (
            <TableContainer
              columns={columns}
              data={teams}
              isGlobalFilter={false}
              isPagination={false}
              customPageSize={pagination.pageSize}
              className="custom-header-css"
            />
          )}
        </CardBody>
      </Card>

      <TeamForm
        isOpen={isFormModalOpen}
        toggle={() => setIsFormModalOpen((v) => !v)}
        team={selectedTeam}
        onSuccess={() => fetchData(pagination.currentPage, pagination.pageSize, searchText)}
      />
    </Container>
  );
};

export default Teams;

