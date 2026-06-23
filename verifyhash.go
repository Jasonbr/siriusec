package main

import (
	"fmt"
	"golang.org/x/crypto/bcrypt"
)

func main() {
	hash := []byte("$2a$10$.rDbjcypYmmTkINpsXjwIOX29ub8WCVgkVkGN9Fjwm1xtqys6Q0gW")
	password := []byte("admin123")
	err := bcrypt.CompareHashAndPassword(hash, password)
	if err != nil {
		fmt.Println("MISMATCH:", err)
	} else {
		fmt.Println("MATCH!")
	}
}
