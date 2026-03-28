import React, { useState, useEffect } from 'react';
import { adminApi, eventsApi } from '../services/api';

export default function AdminDashboard() {
    const [fraudFlags, setFraudFlags] = useState([]);
    const [events, setEvents] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [flags, eventsList] = await Promise.all([
                    adminApi.getFraudFlags(),
                    eventsApi.getAll()
                ]);
                setFraudFlags(flags);
                setEvents(eventsList);
            } catch (error) {
                console.error('Failed to fetch admin data:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, []);

    return (
        <div className="min-h-screen bg-gray-100 p-8">
            <div className="max-w-7xl mx-auto">
                <h1 className="text-4xl font-bold text-gray-800 mb-8">Admin Dashboard</h1>

                {/* Fraud Flags */}
                <div className="bg-white rounded-lg shadow p-8 mb-8">
                    <h2 className="text-2xl font-bold text-gray-800 mb-6">Fraud Flags</h2>
                    <div className="space-y-4">
                        {fraudFlags.map(flag => (
                            <div key={flag.id} className={`p-4 rounded border-l-4 ${flag.severity === 'high' ? 'border-red-500 bg-red-50' : 'border-yellow-500 bg-yellow-50'}`}>
                                <p className="font-semibold text-gray-800">{flag.flag_type}</p>
                                <p className="text-gray-600">{flag.description}</p>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Event Statistics */}
                <div className="bg-white rounded-lg shadow p-8">
                    <h2 className="text-2xl font-bold text-gray-800 mb-6">Events Overview</h2>
                    <div className="space-y-4">
                        {events?.map(event => (
                            <div key={event.id} className="flex justify-between items-center p-4 border rounded">
                                <div>
                                    <p className="font-semibold text-gray-800">{event.title}</p>
                                    <p className="text-gray-600 text-sm">{event.location_name}</p>
                                </div>
                                <p className="text-blue-600 font-semibold">{event.status}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
