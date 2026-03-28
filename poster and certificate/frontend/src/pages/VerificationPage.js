import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { certificatesApi } from '../services/api';

export default function VerificationPage() {
    const { hash } = useParams();
    const [loading, setLoading] = useState(true);
    const [result, setResult] = useState(null);
    const [error, setError] = useState(null);

    useEffect(() => {
        async function verifyCert() {
            setLoading(true);
            setError(null);
            try {
                const res = await certificatesApi.verify(hash);
                if (res.verified) {
                    setResult(res.certificate);
                } else {
                    setError('Certificate not found or invalid.');
                }
            } catch (err) {
                setError('Verification failed.');
            }
            setLoading(false);
        }
        verifyCert();
    }, [hash]);

    if (loading) return <div className="flex justify-center items-center h-screen">Verifying...</div>;
    if (error) return <div className="flex justify-center items-center h-screen text-red-600 font-bold">{error}</div>;

    return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-blue-50 to-green-50 p-8">
            <div className="bg-white rounded-lg shadow-lg p-8 max-w-lg w-full">
                <h1 className="text-2xl font-bold mb-4 text-green-700">Certificate Verified ✓</h1>
                <div className="mb-4">
                    <p><strong>Volunteer:</strong> {result.first_name} {result.last_name}</p>
                    <p><strong>Event:</strong> {result.title}</p>
                    <p><strong>Location:</strong> {result.location_name}</p>
                    <p><strong>Date:</strong> {new Date(result.event_date).toLocaleDateString()}</p>
                    <p><strong>Hours:</strong> {Number(result.total_hours).toFixed(1)} h</p>
                    <p><strong>Waste Collected:</strong> {Number(result.total_waste_kg).toFixed(1)} kg</p>
                    <p><strong>Badge:</strong> {result.badge_tier}</p>
                </div>
                <div className="text-xs text-gray-500">Verification ID: {result.verification_hash}</div>
            </div>
        </div>
    );
}
