import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authApi } from '../services/api';

export default function Register({ setUser }) {
    const [formData, setFormData] = useState({
        email: '',
        password: '',
        firstName: '',
        lastName: '',
        role: 'volunteer'
    });
    const [error, setError] = useState('');
    const navigate = useNavigate();

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const response = await authApi.register(
                formData.email,
                formData.password,
                formData.firstName,
                formData.lastName,
                formData.role
            );

            if (response.error) {
                setError(response.error);
            } else {
                localStorage.setItem('token', response.token);
                localStorage.setItem('user', JSON.stringify(response.user));
                setUser(response.user);
                navigate('/dashboard');
            }
        } catch (err) {
            setError('Registration failed');
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-500 to-green-500 flex items-center justify-center py-12">
            <div className="bg-white rounded-lg shadow-xl p-8 max-w-md w-full">
                <h1 className="text-3xl font-bold text-center text-gray-800 mb-2">ShoreClean</h1>
                <p className="text-center text-gray-600 text-sm mb-8">Join our impact community</p>

                <form onSubmit={handleSubmit}>
                    <div className="grid grid-cols-2 gap-4 mb-4">
                        <div>
                            <label className="block text-gray-700 font-semibold mb-2">First Name</label>
                            <input
                                type="text"
                                name="firstName"
                                value={formData.firstName}
                                onChange={handleChange}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                                placeholder="e.g. Anish"
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-gray-700 font-semibold mb-2">Last Name</label>
                            <input
                                type="text"
                                name="lastName"
                                value={formData.lastName}
                                onChange={handleChange}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                                placeholder="e.g. Udasi"
                                required
                            />
                        </div>
                    </div>

                    <div className="mb-4">
                        <label className="block text-gray-700 font-semibold mb-2 text-sm uppercase tracking-wider">Join As</label>
                        <div className="grid grid-cols-2 gap-2">
                            <button
                                type="button"
                                onClick={() => setFormData(p => ({ ...p, role: 'volunteer' }))}
                                className={`py-2 px-4 rounded-lg border-2 font-bold transition ${formData.role === 'volunteer' ? 'border-blue-500 bg-blue-50 text-blue-600' : 'border-gray-200 text-gray-400'}`}
                            >
                                👤 Volunteer
                            </button>
                            <button
                                type="button"
                                onClick={() => setFormData(p => ({ ...p, role: 'organizer' }))}
                                className={`py-2 px-4 rounded-lg border-2 font-bold transition ${formData.role === 'organizer' ? 'border-green-500 bg-green-50 text-green-600' : 'border-gray-200 text-gray-400'}`}
                            >
                                🏢 NGO Organizer
                            </button>
                        </div>
                    </div>

                    <div className="mb-4">
                        <label className="block text-gray-700 font-semibold mb-2">Email</label>
                        <input
                            type="email"
                            name="email"
                            value={formData.email}
                            onChange={handleChange}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                            required
                        />
                    </div>

                    <div className="mb-6">
                        <label className="block text-gray-700 font-semibold mb-2">Password</label>
                        <input
                            type="password"
                            name="password"
                            value={formData.password}
                            onChange={handleChange}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                            required
                        />
                    </div>

                    {error && <div className="text-red-500 mb-4 text-center text-sm">{error}</div>}

                    <button
                        type="submit"
                        className={`w-full text-white font-bold py-3 rounded-lg transition transform active:scale-95 shadow-lg ${formData.role === 'organizer' ? 'bg-green-600 hover:bg-green-700' : 'bg-blue-600 hover:bg-blue-700'}`}
                    >
                        Create {formData.role === 'organizer' ? 'Organizer' : 'Volunteer'} Account
                    </button>
                </form>

                <p className="text-center text-gray-600 mt-4 text-sm">
                    Already have an account?{' '}
                    <a href="/login" className="text-blue-500 hover:underline font-semibold">
                        Login
                    </a>
                </p>
            </div>
        </div>
    );
}
