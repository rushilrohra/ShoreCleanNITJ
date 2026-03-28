import React, { useState, useEffect } from 'react';
import { certificatesApi } from '../services/api';

const API_ORIGIN = process.env.REACT_APP_API_BASE
    ? new URL(process.env.REACT_APP_API_BASE).origin
    : 'http://localhost:5000';

export default function CertificateGallery() {
    const [certificates, setCertificates] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchCertificates = async () => {
            try {
                const certs = await certificatesApi.getMyCertificates();
                setCertificates(certs);
            } catch (error) {
                console.error('Failed to fetch certificates:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchCertificates();
    }, []);

    if (loading) return <div className="p-6">Loading...</div>;

    return (
        <div className="min-h-screen bg-gray-100 p-8">
            <div className="max-w-7xl mx-auto">
                <h1 className="text-4xl font-bold text-gray-800 mb-8">Your Certificates</h1>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {certificates.map(cert => (
                        <div key={cert.id} className="bg-white rounded-lg shadow hover:shadow-lg transition p-6">
                            <div className="flex justify-between items-start mb-4">
                                <h3 className="text-lg font-bold text-gray-800">{cert.event_title}</h3>
                                <span className="px-3 py-1 bg-blue-500 text-white rounded-full text-xs font-semibold">
                                    {cert.badge_tier}
                                </span>
                            </div>
                            <p className="text-gray-600 text-sm mb-4">{cert.location_name}</p>
                            <div className="space-y-2 mb-4">
                                <p className="text-gray-700"><strong>Date:</strong> {new Date(cert.issue_date).toLocaleDateString()}</p>
                                <p className="text-gray-700"><strong>Hours:</strong> {cert.total_hours}h</p>
                                <p className="text-gray-700"><strong>Waste:</strong> {cert.total_waste_kg} kg</p>
                            </div>
                            <a
                                href={`${API_ORIGIN}${cert.certificate_url}`}
                                download={`ShoreClean_Certificate_${cert.id}.pdf`}
                                className="w-full bg-blue-500 text-white py-2 rounded hover:bg-blue-600 transition text-center"
                            >
                                📥 Download Certificate
                            </a>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
