import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "react-hot-toast";
import { FaDownload, FaPrint, FaSyncAlt, FaFileAlt } from "react-icons/fa";
import {
  AdminReportData,
  fetchAdminReportData,
  formatReportDate,
} from "../utils/adminReportData";
import { generateAdminReportPdf } from "../utils/adminReportPdf";

export default function AdminReportGeneration() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [reportData, setReportData] = useState<AdminReportData | null>(null);
  const printRef = useRef<HTMLDivElement>(null);

  const loadReport = useCallback(async (isManualRefresh = false) => {
    if (isManualRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const data = await fetchAdminReportData();
      setReportData(data);
    } catch (error) {
      console.error("Error loading report data:", error);
      toast.error("Failed to load report data");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadReport();
  }, [loadReport]);

  const handleDownloadPdf = () => {
    if (!reportData) return;
    setGeneratingPdf(true);
    try {
      generateAdminReportPdf(reportData);
      toast.success("Report downloaded as PDF");
    } catch (error) {
      console.error("PDF generation error:", error);
      toast.error("Failed to generate PDF");
    } finally {
      setGeneratingPdf(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[50vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-violet-600" />
      </div>
    );
  }

  if (!reportData) {
    return (
      <div className="p-6 text-center text-gray-500">
        <p>Unable to load report data.</p>
        <button
          type="button"
          onClick={() => void loadReport(true)}
          className="mt-4 px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <>
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #admin-report-print-area,
          #admin-report-print-area * {
            visibility: visible;
          }
          #admin-report-print-area {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            padding: 0;
            margin: 0;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>

      <div className="p-6">
        <div className="no-print flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h2 className="text-2xl font-bold text-violet-900 flex items-center gap-2">
              <FaFileAlt />
              Report Generation
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              Pet owners with their pets, adopters with adopted pets — download as PDF or print.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void loadReport(true)}
              disabled={refreshing}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-violet-300 text-violet-700 font-semibold hover:bg-violet-50 disabled:opacity-50"
            >
              <FaSyncAlt className={refreshing ? "animate-spin" : ""} />
              Refresh
            </button>
            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-violet-300 text-violet-700 font-semibold hover:bg-violet-50"
            >
              <FaPrint />
              Print
            </button>
            <button
              type="button"
              onClick={handleDownloadPdf}
              disabled={generatingPdf}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-violet-600 text-white font-semibold hover:bg-violet-700 disabled:opacity-50"
            >
              <FaDownload />
              {generatingPdf ? "Generating..." : "Download PDF"}
            </button>
          </div>
        </div>

        <div
          id="admin-report-print-area"
          ref={printRef}
          className="bg-white rounded-lg shadow-md p-6 md:p-8"
        >
          <div className="text-center border-b border-gray-200 pb-6 mb-6">
            <h1 className="text-2xl md:text-3xl font-bold text-violet-700">Pawpal Admin Report</h1>
            <p className="text-gray-500 mt-2">
              Generated on {formatReportDate(reportData.generatedAt)}
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <SummaryCard label="Pet Owners" value={reportData.summary.totalOwners} />
            <SummaryCard label="Total Pets Listed" value={reportData.summary.totalPetsListed} />
            <SummaryCard label="Pet Adopters" value={reportData.summary.totalAdopters} />
            <SummaryCard label="Adopted Pets" value={reportData.summary.totalAdoptedPets} />
          </div>

          <section className="mb-10">
            <h3 className="text-xl font-bold text-violet-800 mb-4 pb-2 border-b border-violet-100">
              Pet Owners & Their Pets
            </h3>
            {reportData.petOwners.length === 0 ? (
              <p className="text-gray-400 italic">No pet owners found.</p>
            ) : (
              <div className="space-y-6">
                {reportData.petOwners.map((owner, index) => (
                  <div key={owner.owner_id} className="break-inside-avoid">
                    <div className="mb-2">
                      <h4 className="font-semibold text-gray-900">
                        {index + 1}. {owner.owner_name}
                      </h4>
                      <p className="text-sm text-gray-500">
                        {owner.owner_email} · Joined {formatReportDate(owner.joined_at)}
                      </p>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="min-w-full text-sm border border-gray-200 rounded-lg overflow-hidden">
                        <thead className="bg-violet-50">
                          <tr>
                            <th className="px-3 py-2 text-left font-medium text-gray-600">Pet Name</th>
                            <th className="px-3 py-2 text-left font-medium text-gray-600">Type</th>
                            <th className="px-3 py-2 text-left font-medium text-gray-600">Breed</th>
                            <th className="px-3 py-2 text-left font-medium text-gray-600">Status</th>
                            <th className="px-3 py-2 text-left font-medium text-gray-600">Location</th>
                            <th className="px-3 py-2 text-left font-medium text-gray-600">Listed On</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {owner.pets.map((pet) => (
                            <tr key={pet.id}>
                              <td className="px-3 py-2 font-medium">{pet.name}</td>
                              <td className="px-3 py-2">{pet.pet_type || "—"}</td>
                              <td className="px-3 py-2">{pet.breed || "—"}</td>
                              <td className="px-3 py-2">
                                <span className="inline-block px-2 py-0.5 rounded text-xs bg-gray-100">
                                  {pet.status}
                                </span>
                              </td>
                              <td className="px-3 py-2">{pet.location || "—"}</td>
                              <td className="px-3 py-2">{formatReportDate(pet.created_at)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section>
            <h3 className="text-xl font-bold text-violet-800 mb-4 pb-2 border-b border-violet-100">
              Pet Adopters & Adopted Pets
            </h3>
            {reportData.adopters.length === 0 ? (
              <p className="text-gray-400 italic">No adoption records found.</p>
            ) : (
              <div className="space-y-6">
                {reportData.adopters.map((adopter, index) => (
                  <div key={adopter.adopter_id} className="break-inside-avoid">
                    <div className="mb-2">
                      <h4 className="font-semibold text-gray-900">
                        {index + 1}. {adopter.adopter_name}
                      </h4>
                      {adopter.adopter_email && (
                        <p className="text-sm text-gray-500">{adopter.adopter_email}</p>
                      )}
                    </div>
                    <div className="overflow-x-auto">
                      <table className="min-w-full text-sm border border-gray-200 rounded-lg overflow-hidden">
                        <thead className="bg-violet-50">
                          <tr>
                            <th className="px-3 py-2 text-left font-medium text-gray-600">Pet Name</th>
                            <th className="px-3 py-2 text-left font-medium text-gray-600">Type</th>
                            <th className="px-3 py-2 text-left font-medium text-gray-600">Breed</th>
                            <th className="px-3 py-2 text-left font-medium text-gray-600">Original Owner</th>
                            <th className="px-3 py-2 text-left font-medium text-gray-600">Adopted On</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {adopter.adopted_pets.map((pet) => (
                            <tr key={pet.post_id}>
                              <td className="px-3 py-2 font-medium">{pet.post_name}</td>
                              <td className="px-3 py-2">{pet.pet_type || "—"}</td>
                              <td className="px-3 py-2">{pet.breed || "—"}</td>
                              <td className="px-3 py-2">{pet.owner_name || "—"}</td>
                              <td className="px-3 py-2">{formatReportDate(pet.adopted_at)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </>
  );
}

function SummaryCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-violet-50 rounded-lg p-4 text-center">
      <p className="text-2xl font-bold text-violet-700">{value}</p>
      <p className="text-xs md:text-sm text-gray-600 mt-1">{label}</p>
    </div>
  );
}
