/*
Copyright 2021 Siriusec

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

package utils

import (
	"errors"
	"net"

	"github.com/siriusec/siriusec/api/constants"
	"github.com/gravitational/trace"
)

// IsUseOfClosedNetworkError returns true if the specified error
// indicates the use of closed network connection
func IsUseOfClosedNetworkError(err error) bool {
	if err == nil {
		return false
	}
	if errors.Is(err, net.ErrClosed) {
		return true
	}
	// Fallback for wrapped errors that don't unwrap to net.ErrClosed
	return trace.Unwrap(err).Error() == constants.UseOfClosedNetworkConnection
}

// IsOKNetworkError returns true if the provided error received from a network
// operation is one of those that usually indicate normal connection close.
func IsOKNetworkError(err error) bool {
	return trace.IsEOF(err) || IsUseOfClosedNetworkError(err)
}
