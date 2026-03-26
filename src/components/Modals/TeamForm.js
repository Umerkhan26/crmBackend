import React, { useEffect, useState } from "react";
import {
  Modal,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  Form,
  FormGroup,
  Label,
  Input,
  FormFeedback,
} from "reactstrap";
import { createTeam, updateTeam } from "../../services/teamService";
import { toast } from "react-toastify";

const TeamForm = ({ isOpen, toggle, team, onSuccess }) => {
  const [formData, setFormData] = useState({
    name: "",
    code: "",
    sortOrder: 1,
    status: "active",
  });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (team) {
      setFormData({
        name: team.name || "",
        code: team.code || "",
        sortOrder: team.sortOrder ?? 1,
        status: team.status || "active",
      });
    } else {
      setFormData({ name: "", code: "", sortOrder: 1, status: "active" });
    }
    setErrors({});
  }, [team, isOpen]);

  const validate = () => {
    const next = {};
    if (!formData.name.trim()) next.name = "Team name is required";
    if (!formData.code.trim()) next.code = "Team code is required (A/B/C...)";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: name === "sortOrder" ? Number(value) : value }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: "" }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    setLoading(true);
    try {
      if (team) {
        await updateTeam(team.id, formData);
        toast.success("Team updated successfully");
      } else {
        await createTeam(formData);
        toast.success("Team created successfully");
      }
      onSuccess?.();
      toggle();
    } catch (err) {
      toast.error(err.message || "Failed to save team");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} toggle={toggle} size="md">
      <ModalHeader toggle={toggle}>{team ? "Edit Team" : "Create Team"}</ModalHeader>
      <Form onSubmit={handleSubmit}>
        <ModalBody>
          <FormGroup>
            <Label>Team Name *</Label>
            <Input
              name="name"
              value={formData.name}
              onChange={handleChange}
              invalid={!!errors.name}
              placeholder="Team A"
            />
            {errors.name && <FormFeedback>{errors.name}</FormFeedback>}
          </FormGroup>

          <FormGroup>
            <Label>Code *</Label>
            <Input
              name="code"
              value={formData.code}
              onChange={handleChange}
              invalid={!!errors.code}
              placeholder="A"
            />
            {errors.code && <FormFeedback>{errors.code}</FormFeedback>}
          </FormGroup>

          <FormGroup>
            <Label>Sort Order</Label>
            <Input
              type="number"
              name="sortOrder"
              value={formData.sortOrder}
              onChange={handleChange}
              min={1}
            />
          </FormGroup>

          <FormGroup>
            <Label>Status</Label>
            <Input type="select" name="status" value={formData.status} onChange={handleChange}>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </Input>
          </FormGroup>
        </ModalBody>
        <ModalFooter>
          <Button type="button" color="secondary" onClick={toggle} disabled={loading}>
            Cancel
          </Button>
          <Button type="submit" color="primary" disabled={loading}>
            {loading ? "Saving..." : team ? "Update" : "Create"}
          </Button>
        </ModalFooter>
      </Form>
    </Modal>
  );
};

export default TeamForm;

