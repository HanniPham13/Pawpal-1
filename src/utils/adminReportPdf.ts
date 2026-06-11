import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import {
  AdminReportData,
  formatReportDate,
} from "./adminReportData";

const VIOLET: [number, number, number] = [109, 40, 217];
const GRAY: [number, number, number] = [107, 114, 128];

function addSectionTitle(doc: jsPDF, title: string, y: number): number {
  doc.setFontSize(14);
  doc.setTextColor(...VIOLET);
  doc.setFont("helvetica", "bold");
  doc.text(title, 14, y);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(0, 0, 0);
  return y + 8;
}

export function generateAdminReportPdf(data: AdminReportData): void {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  let y = 20;

  doc.setFontSize(20);
  doc.setTextColor(...VIOLET);
  doc.setFont("helvetica", "bold");
  doc.text("Pawpal Admin Report", pageWidth / 2, y, { align: "center" });
  y += 10;

  doc.setFontSize(10);
  doc.setTextColor(...GRAY);
  doc.setFont("helvetica", "normal");
  doc.text(`Generated: ${formatReportDate(data.generatedAt)}`, pageWidth / 2, y, {
    align: "center",
  });
  y += 14;

  doc.setFontSize(11);
  doc.setTextColor(0, 0, 0);
  const summaryLines = [
    `Pet Owners: ${data.summary.totalOwners}`,
    `Total Pets Listed: ${data.summary.totalPetsListed}`,
    `Pet Adopters: ${data.summary.totalAdopters}`,
    `Adopted Pets: ${data.summary.totalAdoptedPets}`,
  ];
  summaryLines.forEach((line) => {
    doc.text(line, 14, y);
    y += 6;
  });
  y += 6;

  y = addSectionTitle(doc, "Pet Owners & Their Pets", y);

  data.petOwners.forEach((owner, index) => {
    if (y > 250) {
      doc.addPage();
      y = 20;
    }

    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text(`${index + 1}. ${owner.owner_name}`, 14, y);
    y += 5;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...GRAY);
    doc.text(`Email: ${owner.owner_email}  |  Joined: ${formatReportDate(owner.joined_at)}`, 14, y);
    doc.setTextColor(0, 0, 0);
    y += 4;

    if (owner.pets.length === 0) {
      doc.setFontSize(9);
      doc.text("No pets listed.", 18, y + 4);
      y += 12;
      return;
    }

    autoTable(doc, {
      startY: y,
      head: [["Pet Name", "Type", "Breed", "Status", "Location", "Listed On"]],
      body: owner.pets.map((pet) => [
        pet.name,
        pet.pet_type || "—",
        pet.breed || "—",
        pet.status,
        pet.location || "—",
        formatReportDate(pet.created_at),
      ]),
      margin: { left: 14, right: 14 },
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: VIOLET, textColor: [255, 255, 255] },
      theme: "striped",
    });

    y = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;
  });

  if (data.petOwners.length === 0) {
    doc.setFontSize(10);
    doc.text("No pet owners found.", 14, y);
    y += 10;
  }

  doc.addPage();
  y = 20;
  y = addSectionTitle(doc, "Pet Adopters & Adopted Pets", y);

  data.adopters.forEach((adopter, index) => {
    if (y > 250) {
      doc.addPage();
      y = 20;
    }

    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text(`${index + 1}. ${adopter.adopter_name}`, 14, y);
    y += 5;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...GRAY);
    doc.text(`Email: ${adopter.adopter_email || "N/A"}`, 14, y);
    doc.setTextColor(0, 0, 0);
    y += 4;

    autoTable(doc, {
      startY: y,
      head: [["Pet Name", "Type", "Breed", "Original Owner", "Adopted On"]],
      body: adopter.adopted_pets.map((pet) => [
        pet.post_name,
        pet.pet_type || "—",
        pet.breed || "—",
        pet.owner_name || "—",
        formatReportDate(pet.adopted_at),
      ]),
      margin: { left: 14, right: 14 },
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: VIOLET, textColor: [255, 255, 255] },
      theme: "striped",
    });

    y = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;
  });

  if (data.adopters.length === 0) {
    doc.setFontSize(10);
    doc.text("No adoption records found.", 14, y);
  }

  const dateStamp = new Date().toISOString().slice(0, 10);
  doc.save(`pawpal-admin-report-${dateStamp}.pdf`);
}
