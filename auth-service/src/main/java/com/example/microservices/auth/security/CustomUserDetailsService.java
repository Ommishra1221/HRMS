package com.example.microservices.auth.security;

import java.util.List;

import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;

import com.example.microservices.auth.entity.User;
import com.example.microservices.auth.repository.UserRepository;

/**
 * The BRIDGE between Spring Security and OUR users table.
 *
 * During login, AuthenticationManager.authenticate() needs to (1) find the
 * user and (2) get the stored password hash to compare against. It does both
 * by calling loadUserByUsername() here - we look the user up in auth_db with
 * our own UserRepository and hand Spring the details it expects.
 *
 * The org.springframework.security.core.userdetails.User we return is Spring
 * Security's own little "security principal" object - NOT our JPA entity.
 * Its password field carries the BCrypt HASH; the framework's
 * DaoAuthenticationProvider hashes the typed password and compares the two.
 */
@Service
public class CustomUserDetailsService implements UserDetailsService {

    private final UserRepository userRepository;

    public CustomUserDetailsService(UserRepository userRepository) {
        this.userRepository = userRepository;
    }

    @Override
    public UserDetails loadUserByUsername(String username) throws UsernameNotFoundException {
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new UsernameNotFoundException("User not found: " + username));

        // Exactly one role per account: "ROLE_ADMIN" -> authority "ROLE_ADMIN"
        // (hasRole("ADMIN") looks for precisely that string).
        List<SimpleGrantedAuthority> authorities = user.getRoles().stream()
                .map(role -> new SimpleGrantedAuthority(role.getName()))
                .toList();

        // The 7-argument constructor carries the ACCOUNT STATUS FLAGS. We only
        // use "enabled" (an ADMIN can switch an account off without deleting it);
        // expiry/locking are not part of this project, so they stay true.
        //
        // WHEN enabled IS false the framework throws DisabledException, which
        // AuthServiceImpl turns into the SAME vague 401 as a wrong password.
        // Deliberate: answering "this account is disabled" would confirm to an
        // attacker that the username exists (the check happens before the
        // password is even compared).
        return new org.springframework.security.core.userdetails.User(
                user.getUsername(),
                user.getPassword(),
                user.isEnabled(),  // enabled
                true,              // accountNonExpired
                true,              // credentialsNonExpired
                true,              // accountNonLocked
                authorities);
    }
}
