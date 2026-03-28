import React from 'react';

export default function LeaderboardCard({ entry, index }) {
    const getMedalEmoji = (rank) => {
        if (rank === 1) return '🥇';
        if (rank === 2) return '🥈';
        if (rank === 3) return '🥉';
        return '•';
    };

    return (
        <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200 hover:bg-gray-100 transition">
            <div className="flex items-center gap-4 flex-1">
                <span className="text-2xl font-bold text-gray-400 w-8 text-center">
                    {getMedalEmoji(index)}
                </span>
                <span className="font-semibold text-gray-800">#{index}</span>
                <div>
                    <p className="font-semibold text-gray-800">{entry.first_name} {entry.last_name}</p>
                    <p className="text-gray-600 text-sm">{entry.total_hours?.toFixed(1) || 0}h • {entry.total_waste_kg?.toFixed(1) || 0}kg</p>
                </div>
            </div>
            <div className="text-right">
                <p className="text-2xl font-bold text-blue-600">{entry.impact_score}</p>
                <p className="text-gray-600 text-xs">pts</p>
            </div>
        </div>
    );
}
