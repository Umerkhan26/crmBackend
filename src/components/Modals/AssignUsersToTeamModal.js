import React, { useEffect, useState } from "react";
import {
  Modal,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  Input,
  FormGroup,
  Label,
  Form,
} from "reactstrap";
import { addUsersToTeam } from "../../services/teamService";
import { getAllUsers } from "../../services/auth";
import { toast } from "react-toastify";

const AssignUsersToTeamModal = ({ isOpen, toggle, teamId, onSuccess }) => {
  const [users, setUsers] = useState([]);
  const [selectedUserIds, setSelectedUserIds] = useState([]);
  const [loading, setLoading] = useState(false);
  const [fetchingUsers, setFetchingUsers] = useState(false);
  const [search, setSearch] = useState("");

  const fetchUsers = async () => {
    try {
      setFetchingUsers(true);
      const response = await getAllUsers({ page: 1, limit: 1000, search });
      if (response.success) setUsers(response.data || []);
    } catch (error) {
      toast.error(error.message || "Failed to fetch users");
    } finally {
      setFetchingUsers(false);
    }
  };

  useEffect(() => {
    if (isOpen && teamId) fetchUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, teamId]);

  useEffect(() => {
    if (!isOpen) return;
    const t = setTimeout(() => fetchUsers(), 500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, isOpen]);

  const handleToggleUser = (userId) => {
    setSelectedUserIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId],
    );
  };

  const handleSelectAll = () => {
    if (selectedUserIds.length === users.length) setSelectedUserIds([]);
    else setSelectedUserIds(users.map((u) => u.id));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (selectedUserIds.length === 0) {
      toast.warning("Please select at least one user");
      return;
    }

    setLoading(true);
    try {
      const resp = await addUsersToTeam(teamId, selectedUserIds);
      toast.success(resp?.data?.message || "Members updated");
      onSuccess?.();
      toggle();
      setSelectedUserIds([]);
    } catch (error) {
      toast.error(error.message || "Failed to add members");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} toggle={toggle} size="lg">
      <ModalHeader toggle={toggle}>Add Members to Team</ModalHeader>
      <Form onSubmit={handleSubmit}>
        <ModalBody style={{ maxHeight: "500px", overflowY: "auto" }}>
          <FormGroup>
            <Label>Search Users</Label>
            <Input
              type="text"
              placeholder="Search by name or email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </FormGroup>

          <div className="mb-2">
            <Button type="button" color="link" size="sm" onClick={handleSelectAll}>
              {selectedUserIds.length === users.length ? "Deselect All" : "Select All"}
            </Button>
            <span className="ms-2 text-muted">{selectedUserIds.length} selected</span>
          </div>

          {fetchingUsers ? (
            <div className="text-center py-4">
              <div className="spinner-border spinner-border-sm" role="status">
                <span className="visually-hidden">Loading...</span>
              </div>
            </div>
          ) : (
            <div style={{ maxHeight: "350px", overflowY: "auto" }}>
              {users.length === 0 ? (
                <p className="text-muted text-center">No users found</p>
              ) : (
                users.map((u) => (
                  <div key={u.id} className="form-check mb-2">
                    <input
                      className="form-check-input"
                      type="checkbox"
                      id={`team-user-${u.id}`}
                      checked={selectedUserIds.includes(u.id)}
                      onChange={() => handleToggleUser(u.id)}
                    />
                    <label className="form-check-label" htmlFor={`team-user-${u.id}`}>
                      {u.firstname} {u.lastname} ({u.email})
                    </label>
                  </div>
                ))
              )}
            </div>
          )}
        </ModalBody>
        <ModalFooter>
          <Button type="button" color="secondary" onClick={toggle} disabled={loading}>
            Cancel
          </Button>
          <Button type="submit" color="primary" disabled={loading}>
            {loading ? "Saving..." : "Add Members"}
          </Button>
        </ModalFooter>
      </Form>
    </Modal>
  );
};

export default AssignUsersToTeamModal;

